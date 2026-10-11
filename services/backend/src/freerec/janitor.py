"""Deletes files and records of expired jobs.

S3 lifecycle rules work in whole days, so the hour-level retention promise is
kept by this sweeper; a 1-day bucket lifecycle rule is only a backstop.

Run with: python -m freerec.janitor
"""

import logging
import time

from freerec.jobs import job_prefix
from freerec.runtime import Runtime, build_runtime

log = logging.getLogger(__name__)


def sweep(rt: Runtime, now: float | None = None) -> int:
    """Deletes everything belonging to jobs whose retention has passed. Returns the count."""
    ids = rt.jobs.due_for_cleanup(time.time() if now is None else now)
    for job_id in ids:
        rt.storage.delete_prefix(job_prefix(job_id))
        rt.jobs.delete(job_id)
    return len(ids)


def main(interval_seconds: float = 60) -> None:
    logging.basicConfig(level=logging.INFO)
    rt = build_runtime()
    while True:
        try:
            if count := sweep(rt):
                log.info("deleted %d expired job(s)", count)
        except Exception:
            log.exception("sweep failed")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
