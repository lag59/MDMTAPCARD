import os
import boto3
from botocore.config import Config
from app.config import settings


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.STORAGE_ENDPOINT or None,
        aws_access_key_id=settings.STORAGE_ACCESS_KEY,
        aws_secret_access_key=settings.STORAGE_SECRET_KEY,
        config=Config(signature_version="s3v4"),
    )


def upload_file(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    # R2 does not support per-object ACLs; public access is configured on the bucket.
    _client().put_object(
        Bucket=settings.STORAGE_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"{settings.STORAGE_PUBLIC_URL}/{key}"


def save_public_asset(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Store an asset in S3/R2 when configured, else on local disk. Returns a public URL."""
    if settings.STORAGE_BUCKET:
        return upload_file(key, data, content_type)

    dest_dir = os.path.join(settings.UPLOAD_DIR, os.path.dirname(key))
    os.makedirs(dest_dir, exist_ok=True)
    with open(os.path.join(settings.UPLOAD_DIR, key), "wb") as f:
        f.write(data)
    return f"{settings.API_PUBLIC_URL.rstrip('/')}/{settings.UPLOAD_DIR}/{key}"

