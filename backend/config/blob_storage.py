"""Public catalog images in Vercel Blob, without network work during startup."""

import mimetypes
import os
import re
from pathlib import PurePosixPath
from urllib.parse import quote
from uuid import uuid4

from django.core.exceptions import ImproperlyConfigured, SuspiciousFileOperation
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.core.files.utils import validate_file_name
from django.utils.deconstruct import deconstructible


def blob_storage_options(store_id: str, public_base_url: str) -> dict:
    """Validate the selected public store without resolving any credentials."""
    identifier = store_id.removeprefix("store_")
    if not re.fullmatch(r"[a-zA-Z0-9]+", identifier):
        raise ImproperlyConfigured(
            "BLOB_STORE_ID must identify the intended Blob store."
        )
    expected = f"https://{identifier.lower()}.public.blob.vercel-storage.com"
    if public_base_url != expected:
        raise ImproperlyConfigured(
            "BLOB_PUBLIC_BASE_URL must be the exact HTTPS public origin "
            "for BLOB_STORE_ID."
        )
    return {"store_id": store_id, "public_base_url": public_base_url}


@deconstructible
class BlobStorage(Storage):
    def __init__(self, *, store_id: str, public_base_url: str):
        options = blob_storage_options(store_id, public_base_url)
        self.store_id = options["store_id"]
        self.public_base_url = options["public_base_url"]

    @staticmethod
    def _name(name: str) -> str:
        if (
            not name
            or "\\" in name
            or any(ord(char) < 32 or ord(char) == 127 for char in name)
        ):
            raise SuspiciousFileOperation("Invalid object storage pathname.")
        validate_file_name(name, allow_relative_path=True)
        if "//" in name or "." in name.split("/"):
            raise SuspiciousFileOperation("Invalid object storage pathname.")
        return name

    def get_available_name(self, name, max_length=None):
        name = self._name(name)
        path = PurePosixPath(name)
        # A bounded immutable name fits the existing ImageField(max_length=100).
        candidate = str(path.parent / f"{uuid4().hex}{path.suffix.lower()}")
        if max_length is not None and len(candidate) > max_length:
            raise SuspiciousFileOperation("The image pathname exceeds its field limit.")
        return super().get_available_name(candidate, max_length=max_length)

    def _call(self, operation, name, *args, **kwargs):
        # Import lazily: settings, collectstatic and public URL rendering need
        # neither SDK sessions nor credentials or provider requests.
        from vercel.api import session
        from vercel.blob import sync as blob
        from vercel.oidc import VercelOidcTokenError, get_vercel_oidc_token_sync

        def credentials():
            try:
                token = get_vercel_oidc_token_sync()
                kind = blob.CredentialKind.OIDC
            except VercelOidcTokenError:
                token = os.environ.get("BLOB_READ_WRITE_TOKEN") or os.environ.get(
                    "VERCEL_BLOB_READ_WRITE_TOKEN"
                )
                kind = blob.CredentialKind.READ_WRITE
            # Binding even the fallback token to our store prevents accidental
            # requests to a different store identified by an unrelated token.
            return blob.BlobCredentials(
                token=token or "", store_id=self.store_id, kind=kind
            )

        try:
            options = blob.SyncBlobServiceOptions(
                credentials_factory=credentials, base_url="https://vercel.com/api/blob"
            )
            with session(service_options=[options]):
                return getattr(blob, operation)(self._name(name), *args, **kwargs)
        except blob.BlobNotFoundError:
            raise FileNotFoundError("The stored image does not exist.") from None
        except blob.BlobAccessError:
            raise PermissionError("Access to image storage was denied.") from None
        except blob.BlobError:
            # SDK exception messages may contain provider responses. Keep
            # credentials, request URLs and raw payloads out of Django logs.
            raise OSError("The image storage request failed.") from None

    def _save(self, name, content):
        name = self._name(name)
        content.seek(0)
        result = self._call(
            "put_blob",
            name,
            content,
            access="public",
            content_length=content.size,
            content_type=(
                getattr(content, "content_type", None)
                or mimetypes.guess_type(name)[0]
                or "application/octet-stream"
            ),
            add_random_suffix=False,
            allow_overwrite=False,
        )
        if result.pathname != name or result.url != self.url(name):
            raise OSError("Image storage returned an unexpected object location.")
        return result.pathname

    def _open(self, name, mode="rb"):
        if mode not in {"r", "rb"}:
            raise ValueError("Stored images can only be opened for reading.")
        result = self._call("get_blob", name, access="public")
        return ContentFile(result.body, name=name)

    def exists(self, name):
        try:
            self._call("head_blob", name)
        except FileNotFoundError:
            return False
        return True

    def size(self, name):
        return self._call("head_blob", name).size

    def get_modified_time(self, name):
        return self._call("head_blob", name).uploaded_at

    def delete(self, name):
        try:
            self._call("delete_blob", name)
        except FileNotFoundError:
            pass

    def url(self, name):
        return f"{self.public_base_url}/{quote(self._name(name), safe='/')}"
