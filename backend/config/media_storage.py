"""Environment contract for filesystem, public S3 and Vercel Blob media."""

from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.validators import DomainNameValidator

from config.blob_storage import blob_storage_options


def media_storage(env) -> dict:
    backend = env.str("MEDIA_STORAGE", default="filesystem")
    if backend == "filesystem":
        return {"BACKEND": "django.core.files.storage.FileSystemStorage"}
    if backend == "vercel_blob":
        return {
            "BACKEND": "config.blob_storage.BlobStorage",
            "OPTIONS": blob_storage_options(
                env.str("BLOB_STORE_ID", default=""),
                env.str("BLOB_PUBLIC_BASE_URL", default=""),
            ),
        }
    if backend != "s3":
        raise ImproperlyConfigured(
            "MEDIA_STORAGE must be filesystem, s3 or vercel_blob."
        )

    options = {}
    for name, option in (
        ("AWS_ACCESS_KEY_ID", "access_key"),
        ("AWS_SECRET_ACCESS_KEY", "secret_key"),
        ("AWS_STORAGE_BUCKET_NAME", "bucket_name"),
    ):
        value = env.str(name, default="")
        if not value.strip():
            raise ImproperlyConfigured(f"{name} is required for MEDIA_STORAGE=s3.")
        options[option] = value

    endpoint = env.str("AWS_S3_ENDPOINT_URL", default="")
    if endpoint:
        parsed = urlsplit(endpoint)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ImproperlyConfigured("AWS_S3_ENDPOINT_URL must be an HTTP(S) URL.")

    domain = env.str("AWS_S3_CUSTOM_DOMAIN", default="")
    if domain:
        try:
            DomainNameValidator(accept_idna=False)(domain)
        except ValidationError as exc:
            raise ImproperlyConfigured(
                "AWS_S3_CUSTOM_DOMAIN must contain only a valid ASCII hostname."
            ) from exc
    addressing_style = env.str("AWS_S3_ADDRESSING_STYLE", default="auto")
    if addressing_style not in {"auto", "path", "virtual"}:
        raise ImproperlyConfigured(
            "AWS_S3_ADDRESSING_STYLE must be auto, path or virtual."
        )

    options.update(
        endpoint_url=endpoint or None,
        region_name=env.str("AWS_S3_REGION_NAME", default="") or None,
        addressing_style=addressing_style,
        custom_domain=domain or None,
        signature_version="s3v4",
        default_acl=None,
        querystring_auth=False,
        file_overwrite=False,
        url_protocol="https:",
    )
    return {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": options}
