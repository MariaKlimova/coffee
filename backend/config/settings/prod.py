"""Production settings."""

from .base import *  # noqa: F403

DEBUG = False

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Railway / Render / reverse proxies terminate TLS; trust the forwarded host.
USE_X_FORWARDED_HOST = True

# Render sets RENDER_EXTERNAL_HOSTNAME automatically.
_render_host = env("RENDER_EXTERNAL_HOSTNAME", default=None)  # noqa: F405
if _render_host and _render_host not in ALLOWED_HOSTS:  # noqa: F405
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, _render_host]  # noqa: F405
