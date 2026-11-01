"""Свежий запуск настоящего Vercel settings + S3 backend без обращения к облаку."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def vercel_process(code: str, patch: dict[str, str] | None = None):
    """Изолируем Django settings в процессе, S3-контракт не подменяем."""
    environment = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.vercel",
        "COFFEE_ENVIRONMENT": "staging",
        "VERCEL_ENV": "preview",
        "VERCEL_URL": "coffee64-deployment.example.test",
        "ALLOWED_HOSTS": "coffee64-api.example.test",
        "CORS_ALLOWED_ORIGINS": "https://coffee64-frontend.example.test",
        "CSRF_TRUSTED_ORIGINS": "https://coffee64-api.example.test",
        "DATABASE_URL": (
            "postgresql://synthetic:synthetic@ep-test-pooler.example.test/coffee64"
            "?sslmode=require&channel_binding=require"
        ),
        "MEDIA_STORAGE": "s3",
        "AWS_ACCESS_KEY_ID": "synthetic-access-key",
        "AWS_SECRET_ACCESS_KEY": "synthetic-secret-key",
        "AWS_STORAGE_BUCKET_NAME": "coffee64-assets",
        "AWS_S3_ENDPOINT_URL": "https://storage.example.test",
        "AWS_S3_REGION_NAME": "test-region",
        "AWS_S3_ADDRESSING_STYLE": "path",
        "AWS_S3_CUSTOM_DOMAIN": "",
        "AWS_EC2_METADATA_DISABLED": "true",
        "YOOKASSA_SHOP_ID": "",
        "YOOKASSA_SECRET_KEY": "",
        "DEBUG": "False",
        "SERVE_MEDIA": "True",
    }
    environment.update(patch or {})
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )


def test_real_vercel_wsgi_s3_and_static_build_have_no_database_or_s3_writes():
    result = vercel_process(
        """
import json
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.handlers.wsgi import WSGIHandler
from django.db.backends.base.base import BaseDatabaseWrapper
from storages.backends.s3 import S3Storage

with patch.object(
    BaseDatabaseWrapper, 'ensure_connection',
    side_effect=AssertionError('Native build/startup must not connect to DB'),
), patch.object(
    S3Storage, '_save', side_effect=AssertionError('Build must not upload to S3'),
):
    from config.vercel_wsgi import application
    from django.conf import settings
    from django.core.files.storage import storages
    from django.core.management import call_command
    from django.test import Client, override_settings
    from django.urls import Resolver404, resolve
    from pathlib import Path

    assert isinstance(application, WSGIHandler)
    assert settings.SETTINGS_MODULE == 'config.settings.vercel'
    assert settings.MEDIA_STORAGE == 's3'
    assert settings.SERVE_MEDIA is False
    assert isinstance(storages['default'], S3Storage)
    assert settings.STORAGES['staticfiles']['BACKEND'].endswith('StaticFilesStorage')
    assert storages['default'].url('catalog/example.png') == (
        'https://storage.example.test/coffee64-assets/catalog/example.png'
    )
    assert settings.DATABASES['default']['OPTIONS']['sslmode'] == 'require'
    assert settings.DATABASES['default']['CONN_MAX_AGE'] == 0
    try:
        resolve('/media/private.png')
    except Resolver404:
        pass
    else:
        raise AssertionError('S3 mode must not expose a filesystem media route')

    client = Client(enforce_csrf_checks=True)
    response = client.get(
        '/api/health/', secure=True, HTTP_HOST='coffee64-api.example.test',
        HTTP_ORIGIN='https://coffee64-frontend.example.test',
    )
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}
    assert response['Access-Control-Allow-Origin'] == (
        'https://coffee64-frontend.example.test'
    )
    assert response['Access-Control-Expose-Headers'] == 'X-Cart-Token'
    forbidden_origin = client.get(
        '/api/health/', secure=True, HTTP_HOST='coffee64-api.example.test',
        HTTP_ORIGIN='https://untrusted.example.test',
    )
    assert 'Access-Control-Allow-Origin' not in forbidden_origin
    preflight = client.options(
        '/api/cart/', secure=True, HTTP_HOST='coffee64-api.example.test',
        HTTP_ORIGIN='https://coffee64-frontend.example.test',
        HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS='x-cart-token',
    )
    assert preflight.status_code == 200
    assert 'x-cart-token' in preflight['Access-Control-Allow-Headers'].lower()
    csrf = client.post(
        '/admin/login/', secure=True, HTTP_HOST='coffee64-api.example.test',
    )
    assert csrf.status_code == 403

    with (
        TemporaryDirectory() as static_root,
        override_settings(STATIC_ROOT=static_root),
    ):
        call_command('check', deploy=True, fail_level='ERROR', verbosity=0)
        call_command('collectstatic', interactive=False, verbosity=0)
        assert (Path(static_root) / 'admin/css/base.css').is_file()
    print(json.dumps({'wsgi': 'ok', 's3_backend': type(storages['default']).__name__,
        'health': 200, 'cors_preflight': 200, 'csrf_rejection': 403,
        'static_admin_asset': 'ok', 'database_connections': 0, 's3_uploads': 0}))
"""
    )
    assert result.returncode == 0, result.stderr
    outcome = json.loads(result.stdout.strip().splitlines()[-1])
    assert outcome["wsgi"] == "ok"
    assert outcome["s3_backend"] == "S3Storage"
    assert outcome["database_connections"] == 0
    assert outcome["s3_uploads"] == 0


@pytest.mark.parametrize(
    ("patch", "message"),
    [
        ({"MEDIA_STORAGE": "filesystem"}, "persistent MEDIA_STORAGE=s3"),
        ({"AWS_ACCESS_KEY_ID": ""}, "AWS_ACCESS_KEY_ID is required"),
        (
            {"AWS_S3_ENDPOINT_URL": "http://storage.example.test"},
            "S3 storage must use an HTTPS endpoint",
        ),
        (
            {"COFFEE_ENVIRONMENT": "production"},
            "Preview/Development cannot use production",
        ),
        ({"YOOKASSA_SECRET_KEY": "synthetic-key"}, "Payments must remain unconfigured"),
        ({"ALLOWED_HOSTS": "*"}, "exact hostnames"),
        (
            {
                "DATABASE_URL": "postgresql://test:test@db.example.test/test?sslmode=disable"
            },
            "PostgreSQL connection must require TLS",
        ),
    ],
)
def test_real_entrypoint_refuses_unsafe_environment(patch, message):
    result = vercel_process("from config.vercel_wsgi import application", patch)
    assert result.returncode != 0
    assert message in result.stderr
