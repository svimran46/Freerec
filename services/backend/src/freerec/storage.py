"""S3-compatible object storage (MinIO locally, Cloudflare R2 or S3 in production)."""

from pathlib import Path
from typing import Any
from urllib.parse import quote

import boto3
from botocore.config import Config

from freerec.config import Settings


class Storage:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.s3_bucket
        self.presign_seconds = settings.presign_seconds
        common: dict[str, Any] = {
            "region_name": settings.s3_region,
            "aws_access_key_id": settings.s3_access_key,
            "aws_secret_access_key": settings.s3_secret_key,
            "config": Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        }
        self.client = boto3.client("s3", endpoint_url=settings.s3_endpoint, **common)
        # Presigned URLs embed the host they were signed for, so sign with the
        # endpoint browsers can reach.
        public = settings.s3_public_endpoint or settings.s3_endpoint
        self.public_client = boto3.client("s3", endpoint_url=public, **common)

    def presigned_post(self, key: str, max_bytes: int) -> dict[str, Any]:
        return self.public_client.generate_presigned_post(
            Bucket=self.bucket,
            Key=key,
            Conditions=[["content-length-range", 1, max_bytes]],
            ExpiresIn=self.presign_seconds,
        )

    def presigned_get(self, key: str, filename: str) -> str:
        return self.public_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ResponseContentDisposition": content_disposition(filename),
            },
            ExpiresIn=self.presign_seconds,
        )

    def size(self, key: str) -> int | None:
        try:
            return self.client.head_object(Bucket=self.bucket, Key=key)["ContentLength"]
        except self.client.exceptions.ClientError as error:
            if error.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return None
            raise

    def download(self, key: str, path: Path) -> None:
        self.client.download_file(self.bucket, key, str(path))

    def upload(self, path: Path, key: str) -> None:
        self.client.upload_file(str(path), self.bucket, key)

    def delete_prefix(self, prefix: str) -> None:
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
            if objects:
                self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": objects})


def content_disposition(filename: str) -> str:
    """An attachment header that keeps non-ASCII names (RFC 6266), with an ASCII fallback."""
    fallback = filename.encode("ascii", "replace").decode().replace("?", "_").replace('"', "")
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"
