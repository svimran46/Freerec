from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from FREEREC_* environment variables."""

    model_config = SettingsConfigDict(env_prefix="FREEREC_")

    redis_url: str = "redis://localhost:6379/0"
    queue_name: str = "default"

    s3_endpoint: str | None = "http://localhost:9000"
    # Endpoint browsers use for presigned URLs; differs from s3_endpoint inside Docker.
    s3_public_endpoint: str | None = None
    s3_region: str = "us-east-1"
    s3_bucket: str = "freerec"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    # Origins allowed to upload to and download from the bucket directly.
    cors_origins: list[str] = ["http://localhost:3000"]

    max_file_bytes: int = 100 * 1024 * 1024
    max_files: int = 20
    # Uploads, outputs and job records are deleted this long after job creation.
    retention_seconds: int = 60 * 60
    presign_seconds: int = 15 * 60
    job_timeout_seconds: int = 120

    # Enables the "echo" operation used to smoke-test the pipeline end to end.
    enable_debug_ops: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
