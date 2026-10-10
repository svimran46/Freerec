"""Job records, stored in Redis with a TTL so abandoned jobs disappear on their own."""

import secrets
import time
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field
from redis import Redis

EXPIRY_INDEX = "jobs:expiring"


class JobStatus(StrEnum):
    CREATED = "created"
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    EXPIRED = "expired"


class InputFile(BaseModel):
    name: str
    size: int
    key: str


class OutputFile(BaseModel):
    name: str
    size: int
    key: str


class Job(BaseModel):
    id: str
    tool: str
    status: JobStatus
    options: dict[str, Any] = Field(default_factory=dict)
    inputs: list[InputFile]
    outputs: list[OutputFile] = Field(default_factory=list)
    error: str | None = None
    created_at: float
    expires_at: float

    @property
    def prefix(self) -> str:
        return job_prefix(self.id)

    def expires_at_iso(self) -> str:
        return datetime.fromtimestamp(self.expires_at, UTC).isoformat()


def new_job_id() -> str:
    # The id is the only credential for a job, so it must be unguessable.
    return secrets.token_urlsafe(16)


def job_prefix(job_id: str) -> str:
    return f"jobs/{job_id}/"


def _key(job_id: str) -> str:
    return f"job:{job_id}"


class JobStore:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    def create(self, job: Job) -> None:
        ttl = max(1, int(job.expires_at - time.time()))
        pipe = self.redis.pipeline()
        pipe.set(_key(job.id), job.model_dump_json(), ex=ttl)
        pipe.zadd(EXPIRY_INDEX, {job.id: job.expires_at})
        pipe.execute()

    def save(self, job: Job) -> None:
        # KEEPTTL so updates never extend a job's lifetime.
        self.redis.set(_key(job.id), job.model_dump_json(), keepttl=True, xx=True)

    def get(self, job_id: str) -> Job | None:
        raw = self.redis.get(_key(job_id))
        return Job.model_validate_json(raw) if raw else None

    def delete(self, job_id: str) -> None:
        pipe = self.redis.pipeline()
        pipe.delete(_key(job_id))
        pipe.zrem(EXPIRY_INDEX, job_id)
        pipe.execute()

    def due_for_cleanup(self, now: float, limit: int = 100) -> list[str]:
        ids = self.redis.zrangebyscore(EXPIRY_INDEX, "-inf", now, start=0, num=limit)
        return [i.decode() if isinstance(i, bytes) else i for i in ids]
