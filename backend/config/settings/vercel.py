"""Настройки отдельного Django-проекта на Vercel с внешними PostgreSQL и S3."""

import re
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

COFFEE_ENVIRONMENT = env("COFFEE_ENVIRONMENT", default="")  # noqa: F405
if COFFEE_ENVIRONMENT not in {"preview", "staging", "production"}:
    raise ImproperlyConfigured(
        "Set COFFEE_ENVIRONMENT to preview, staging, or production"
    )
if COFFEE_ENVIRONMENT == "production" and env(  # noqa: F405
    "VERCEL_ENV", default=""
) in {"preview", "development"}:
    raise ImproperlyConfigured("Vercel Preview/Development cannot use production mode")

DEBUG = False
SERVE_MEDIA = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
USE_X_FORWARDED_HOST = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
STATIC_URL = "/static/"


def _exact_host(host: str) -> str:
    """Разрешаем конкретный hostname; wildcard и суффиксные списки запрещены."""
    if (
        not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?", host)
        or ".." in host
    ):
        raise ImproperlyConfigured("ALLOWED_HOSTS must contain exact hostnames")
    return host.lower()


ALLOWED_HOSTS = [
    _exact_host(host) for host in env.list("ALLOWED_HOSTS", default=[])  # noqa: F405
]
_deployment_host = env("VERCEL_URL", default="")  # noqa: F405
if _deployment_host:
    ALLOWED_HOSTS.append(_exact_host(_deployment_host))
ALLOWED_HOSTS = list(dict.fromkeys(ALLOWED_HOSTS))
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set ALLOWED_HOSTS or VERCEL_URL for this backend")


def _https_origins(name: str) -> list[str]:
    """Доверяем только явно перечисленным HTTPS origins без пути и wildcard."""
    origins = env.list(name, default=[])  # noqa: F405
    for origin in origins:
        parsed = urlsplit(origin)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ImproperlyConfigured(f"{name} must contain exact HTTPS origins")
        _exact_host(parsed.hostname)
    return origins


CORS_ALLOWED_ORIGINS = _https_origins("CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = _https_origins("CSRF_TRUSTED_ORIGINS")
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = False

DATABASES = {"default": env.db("DATABASE_URL")}  # noqa: F405
_database = DATABASES["default"]
if _database["ENGINE"] != "django.db.backends.postgresql":
    raise ImproperlyConfigured("Vercel requires an external PostgreSQL database")
_database["CONN_MAX_AGE"] = 0
_database["CONN_HEALTH_CHECKS"] = True
_database["DISABLE_SERVER_SIDE_CURSORS"] = True
_options = _database.setdefault("OPTIONS", {})
_options.setdefault("sslmode", "require")
_options.setdefault("connect_timeout", 10)
if _options["sslmode"] not in {"require", "verify-ca", "verify-full"}:
    raise ImproperlyConfigured("The PostgreSQL connection must require TLS")

# Проверяем и выбор режима, и фактическую интеграцию COFFEE-41, не имитируем S3.
if env("MEDIA_STORAGE", default="") != "s3":  # noqa: F405
    raise ImproperlyConfigured("Vercel requires persistent MEDIA_STORAGE=s3")
if globals().get("STORAGES", {}).get("default", {}).get("BACKEND") != (
    "storages.backends.s3.S3Storage"
):
    raise ImproperlyConfigured("Integrate COFFEE-41 S3 storage before deploying Vercel")
_storage_endpoint = env("AWS_S3_ENDPOINT_URL", default="")  # noqa: F405
if _storage_endpoint and urlsplit(_storage_endpoint).scheme != "https":
    raise ImproperlyConfigured("Vercel S3 storage must use an HTTPS endpoint")

YOOKASSA_SHOP_ID = env("YOOKASSA_SHOP_ID", default="")  # noqa: F405
YOOKASSA_SECRET_KEY = env("YOOKASSA_SECRET_KEY", default="")  # noqa: F405
if COFFEE_ENVIRONMENT != "production" and (YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY):
    raise ImproperlyConfigured("Payments must remain unconfigured in preview/staging")
