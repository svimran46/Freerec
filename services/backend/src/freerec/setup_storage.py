"""Creates the bucket and applies its lifecycle and CORS rules. Safe to run repeatedly.

Run with: python -m freerec.setup_storage
"""

import logging

from botocore.exceptions import ClientError

from freerec.config import Settings, get_settings
from freerec.storage import Storage

log = logging.getLogger(__name__)


def setup_storage(settings: Settings, storage: Storage | None = None) -> None:
    storage = storage or Storage(settings)
    client, bucket = storage.client, settings.s3_bucket
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError:
        client.create_bucket(Bucket=bucket)
        log.info("created bucket %s", bucket)

    # Optional extras: some S3-compatible servers lack these APIs, and the janitor
    # enforces retention regardless.
    try:
        client.put_bucket_lifecycle_configuration(
            Bucket=bucket,
            LifecycleConfiguration={
                "Rules": [
                    {
                        "ID": "expire-jobs-backstop",
                        "Filter": {"Prefix": "jobs/"},
                        "Status": "Enabled",
                        "Expiration": {"Days": 1},
                    }
                ]
            },
        )
    except ClientError as error:
        log.warning("could not set lifecycle rule: %s", error)
    try:
        client.put_bucket_cors(
            Bucket=bucket,
            CORSConfiguration={
                "CORSRules": [
                    {
                        "AllowedOrigins": settings.cors_origins,
                        "AllowedMethods": ["POST", "GET"],
                        "AllowedHeaders": ["*"],
                        "MaxAgeSeconds": 3600,
                    }
                ]
            },
        )
    except ClientError as error:
        log.warning("could not set CORS rules: %s", error)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    setup_storage(get_settings())
