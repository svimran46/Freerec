"""Wires settings, Redis, storage and the queue together for the API and the workers."""

from collections.abc import Callable
from dataclasses import dataclass

from redis import Redis
from rq import Callback, Queue

from freerec.config import Settings, get_settings
from freerec.jobs import JobStore
from freerec.ops import Op, enabled_ops
from freerec.storage import Storage


@dataclass
class Runtime:
    settings: Settings
    redis: Redis
    storage: Storage
    jobs: JobStore
    ops: dict[str, Op]
    enqueue: Callable[[str], None]


def build_runtime(settings: Settings | None = None) -> Runtime:
    settings = settings or get_settings()
    redis = Redis.from_url(settings.redis_url)
    queue = Queue(settings.queue_name, connection=redis)

    def enqueue(job_id: str) -> None:
        queue.enqueue(
            "freerec.worker.run_job",
            job_id,
            job_id=f"job-{job_id}",
            job_timeout=settings.job_timeout_seconds,
            result_ttl=0,
            failure_ttl=settings.retention_seconds,
            on_failure=Callback("freerec.worker.on_job_failure"),
        )

    return Runtime(
        settings=settings,
        redis=redis,
        storage=Storage(settings),
        jobs=JobStore(redis),
        ops=enabled_ops(settings),
        enqueue=enqueue,
    )
