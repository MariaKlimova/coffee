"""DRF exception handler that matches OpenAPI Error schema."""

from typing import Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _flatten_errors(data: Any) -> dict[str, list[str]]:
    """Convert DRF validation errors into {field: [messages]}."""
    if isinstance(data, dict):
        result: dict[str, list[str]] = {}
        for key, value in data.items():
            if isinstance(value, list):
                result[key] = [str(item) for item in value]
            elif isinstance(value, dict):
                nested = _flatten_errors(value)
                for nested_key, messages in nested.items():
                    result[f"{key}.{nested_key}"] = messages
            else:
                result[key] = [str(value)]
        return result
    if isinstance(data, list):
        return {"non_field_errors": [str(item) for item in data]}
    return {"non_field_errors": [str(data)]}


def custom_exception_handler(exc: Exception, context: dict) -> Response | None:
    """
    Wrap DRF errors as {detail, code[, errors]}.

    OpenAPI (COFFEE-8) requires machine-readable `code` plus human `detail`.
    """
    response = exception_handler(exc, context)
    if response is None:
        return None

    code = getattr(exc, "default_code", None) or "error"
    if isinstance(code, str):
        error_code = code
    else:
        error_code = "error"

    data = response.data

    # Validation errors: DRF returns a dict of field → messages
    if (
        response.status_code == status.HTTP_400_BAD_REQUEST
        and isinstance(data, dict)
        and "detail" not in data
    ):
        response.data = {
            "detail": "Invalid input",
            "code": "validation_error",
            "errors": _flatten_errors(data),
        }
        return response

    # Auth / permission / generic detail responses
    if isinstance(data, dict) and "detail" in data:
        detail = data["detail"]
        response.data = {
            "detail": str(detail),
            "code": getattr(detail, "code", None) or error_code,
        }
        return response

    if isinstance(data, list):
        response.data = {
            "detail": "; ".join(str(item) for item in data),
            "code": error_code,
        }
        return response

    response.data = {
        "detail": str(data),
        "code": error_code,
    }
    return response
