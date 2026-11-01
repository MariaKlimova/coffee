"""Явная WSGI-точка входа отдельного Vercel backend-проекта."""

import os

from django.core.exceptions import ImproperlyConfigured
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.vercel")
if os.environ["DJANGO_SETTINGS_MODULE"] != "config.settings.vercel":
    raise ImproperlyConfigured(
        "The Vercel entrypoint requires DJANGO_SETTINGS_MODULE=config.settings.vercel"
    )

application = get_wsgi_application()
