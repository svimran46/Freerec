import os

import boto3
import fakeredis
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from freerec.api import create_app
from freerec.config import Settings
from freerec.jobs import JobStore
from freerec.ops import enabled_ops
from freerec.runtime import Runtime
from freerec.storage import Storage
from freerec.worker import process_job

BUCKET = "freerec-test"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        s3_endpoint=None,
        s3_bucket=BUCKET,
        s3_access_key="testing",
        s3_secret_key="testing",
        max_file_bytes=1024,
        enable_debug_ops=True,
    )


@pytest.fixture
def runtime(settings: Settings):
    os.environ.setdefault("AWS_DEFAULT_REGION", settings.s3_region)
    with mock_aws():
        boto3.client("s3", region_name=settings.s3_region).create_bucket(Bucket=BUCKET)
        redis = fakeredis.FakeRedis()
        rt = Runtime(
            settings=settings,
            redis=redis,
            storage=Storage(settings),
            jobs=JobStore(redis),
            ops=enabled_ops(settings),
            enqueue=lambda job_id: None,
        )
        # Run jobs inline so tests see the finished state right after submit.
        rt.enqueue = lambda job_id: process_job(rt, job_id)
        yield rt


@pytest.fixture
def client(runtime: Runtime) -> TestClient:
    return TestClient(create_app(runtime))


@pytest.fixture
def upload(runtime: Runtime):
    """Simulates the browser's presigned upload by writing the object directly."""

    def _upload(key: str, body: bytes) -> None:
        runtime.storage.client.put_object(Bucket=BUCKET, Key=key, Body=body)

    return _upload


def object_keys(runtime: Runtime, prefix: str = "") -> list[str]:
    listing = runtime.storage.client.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
    return sorted(obj["Key"] for obj in listing.get("Contents", []))
