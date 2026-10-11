"""Job execution. RQ calls `run_job`; tests call `process_job` with their own runtime.

Run a worker with: rq worker --url "$FREEREC_REDIS_URL" default
"""

import ctypes
import logging
import sys
import tempfile
from functools import cache
from pathlib import Path

from pydantic import ValidationError
from rq.timeouts import JobTimeoutException

from freerec.jobs import JobStatus, OutputFile
from freerec.kinds import detect_file_kind
from freerec.ops import InputPath, OpError
from freerec.runtime import Runtime, build_runtime

log = logging.getLogger(__name__)


def _make_non_dumpable() -> None:
    """Hides this process's memory and environment (with the storage keys) from other
    processes of the same user, such as a converter tricked by a malicious file into
    reading /proc. Forked work horses inherit it; converters get a scrubbed environment."""
    if sys.platform == "linux":
        PR_SET_DUMPABLE = 4
        ctypes.CDLL(None, use_errno=True).prctl(PR_SET_DUMPABLE, 0, 0, 0, 0)


_make_non_dumpable()


def process_job(rt: Runtime, job_id: str) -> None:
    job = rt.jobs.get(job_id)
    if job is None or job.status != JobStatus.QUEUED:
        return
    op = rt.ops.get(job.tool)
    if op is None:
        job.status, job.error = JobStatus.FAILED, "This tool is not available."
        rt.jobs.save(job)
        return

    job.status = JobStatus.RUNNING
    rt.jobs.save(job)
    try:
        with tempfile.TemporaryDirectory(prefix=f"job-{job_id}-") as tmp:
            in_dir, out_dir = Path(tmp, "in"), Path(tmp, "out")
            in_dir.mkdir()
            out_dir.mkdir()

            inputs = []
            for i, item in enumerate(job.inputs):
                path = in_dir / str(i)
                rt.storage.download(item.key, path)
                kind = detect_file_kind(path, item.name)
                if kind not in op.accepts:
                    raise OpError(f"{item.name} is not a supported file for this tool.")
                inputs.append(InputPath(path=path, name=item.name, kind=kind))

            options = op.options.model_validate(job.options)
            produced = op.run(inputs, options, out_dir)
            if not produced:
                raise OpError("Processing produced no output.")

            outputs = []
            for path in produced:
                key = f"{job.prefix}out/{path.name}"
                rt.storage.upload(path, key)
                outputs.append(OutputFile(name=path.name, size=path.stat().st_size, key=key))

        job.status, job.outputs = JobStatus.DONE, outputs
    except OpError as error:
        job.status, job.error = JobStatus.FAILED, str(error)
    except ValidationError:
        job.status, job.error = JobStatus.FAILED, "Invalid options for this tool."
    except JobTimeoutException:
        job.status, job.error = JobStatus.FAILED, "Processing took too long. Try a smaller file."
    except Exception:
        log.exception("job %s (%s) failed", job_id, job.tool)
        job.status, job.error = JobStatus.FAILED, "Processing failed. The file may be damaged."
    rt.jobs.save(job)


@cache
def _runtime() -> Runtime:
    return build_runtime()


def run_job(job_id: str) -> None:
    process_job(_runtime(), job_id)


def on_job_failure(rq_job, connection, exc_type, exc_value, traceback) -> None:
    """Marks the job failed when the work horse dies before process_job can do it."""
    rt = _runtime()
    job = rt.jobs.get(rq_job.args[0])
    if job and job.status in (JobStatus.QUEUED, JobStatus.RUNNING):
        job.status, job.error = JobStatus.FAILED, "Processing failed unexpectedly."
        rt.jobs.save(job)
