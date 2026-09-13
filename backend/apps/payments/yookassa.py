"""Thin HTTP client for the YooKassa Payments API v3."""

from __future__ import annotations

import base64
import json
import logging
import uuid
from decimal import Decimal
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


class YooKassaError(Exception):
    """Raised when the YooKassa API returns an error or is unreachable."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _auth_header() -> str:
    shop_id = settings.YOOKASSA_SHOP_ID
    secret = settings.YOOKASSA_SECRET_KEY
    token = base64.b64encode(f"{shop_id}:{secret}".encode()).decode()
    return f"Basic {token}"


def _request(
    method: str,
    path: str,
    *,
    body: dict[str, Any] | None = None,
    idempotence_key: str | None = None,
) -> dict[str, Any]:
    base = settings.YOOKASSA_API_BASE.rstrip("/")
    url = f"{base}{path}"
    headers = {
        "Authorization": _auth_header(),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if idempotence_key:
        headers["Idempotence-Key"] = idempotence_key

    data = None if body is None else json.dumps(body).encode()
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            if not raw:
                return {}
            return json.loads(raw)
    except HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        logger.warning(
            "YooKassa HTTP %s on %s %s: %s",
            exc.code,
            method,
            path,
            detail,
        )
        raise YooKassaError(
            f"YooKassa request failed with HTTP {exc.code}.",
            status_code=exc.code,
        ) from exc
    except URLError as exc:
        logger.warning("YooKassa unreachable on %s %s: %s", method, path, exc)
        raise YooKassaError("YooKassa is unreachable.") from exc


def create_payment(
    *,
    amount: Decimal,
    order_id: str,
    description: str,
    return_url: str | None = None,
) -> dict[str, Any]:
    """
    Create a redirect payment in YooKassa.

    Returns the provider payment object (must include ``id`` and
    ``confirmation.confirmation_url``).
    """
    payload = {
        "amount": {
            "value": f"{amount:.2f}",
            "currency": "RUB",
        },
        "capture": True,
        "confirmation": {
            "type": "redirect",
            "return_url": return_url or settings.YOOKASSA_RETURN_URL,
        },
        "description": description[:128],
        "metadata": {"order_id": order_id},
    }
    return _request(
        "POST",
        "/payments",
        body=payload,
        idempotence_key=str(uuid.uuid4()),
    )


def get_payment(provider_payment_id: str) -> dict[str, Any]:
    """Fetch the current payment object from YooKassa by provider id."""
    return _request("GET", f"/payments/{provider_payment_id}")
