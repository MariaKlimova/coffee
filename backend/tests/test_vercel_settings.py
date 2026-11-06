"""Serverless-настройки и безопасная static-сборка без доступа к БД или S3."""

import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.db.backends.base.base import BaseDatabaseWrapper
from django.test import override_settings

from config.settings import base

BACKEND_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def vercel_environment(monkeypatch):
    """Синтетическая конфигурация; S3-контракт COFFEE-41 подставляется отдельно."""
    values = {
        "COFFEE_ENVIRONMENT": "staging",
        "VERCEL_ENV": "preview",
        "VERCEL_URL": "coffee-api-deployment.example.test",
        "ALLOWED_HOSTS": "coffee-api.example.test",
        "CORS_ALLOWED_ORIGINS": "https://coffee-preview.example.test",
        "CSRF_TRUSTED_ORIGINS": "https://coffee-api.example.test",
        "DATABASE_URL": (
            "postgresql://synthetic:synthetic@ep-test-pooler.example.test/coffee"
            "?sslmode=require&channel_binding=require"
        ),
        "MEDIA_STORAGE": "s3",
        "YOOKASSA_SHOP_ID": "",
        "YOOKASSA_SECRET_KEY": "",
        "YOOKASSA_STAGING_TEST_ENABLED": "False",
        "VERCEL": "1",
    }
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    # Это unit-проверка контракта, не интеграционная приёмка ещё не влитой COFFEE-41.
    monkeypatch.setattr(
        base,
        "STORAGES",
        {
            "default": {"BACKEND": "storages.backends.s3.S3Storage"},
            "staticfiles": {
                "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
            },
        },
        raising=False,
    )
    return values


def load_vercel_settings():
    """Импортируем отдельный модуль без смены общих pytest/Django settings."""
    spec = importlib.util.spec_from_file_location(
        "config.settings._vercel_unit", BACKEND_ROOT / "config/settings/vercel.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_vercel_uses_scoped_secure_postgresql_and_origins(vercel_environment):
    config = load_vercel_settings()
    assert config.COFFEE_ENVIRONMENT == "staging"
    assert config.DEBUG is False
    assert config.SERVE_MEDIA is False
    assert config.SECURE_SSL_REDIRECT is True
    assert config.SESSION_COOKIE_SECURE is True
    assert config.CSRF_COOKIE_SECURE is True
    assert config.STATIC_URL == "/static/"
    assert config.ALLOWED_HOSTS == [
        "coffee-api.example.test",
        "coffee-api-deployment.example.test",
    ]
    assert config.CORS_ALLOWED_ORIGINS == ["https://coffee-preview.example.test"]
    assert config.CSRF_TRUSTED_ORIGINS == ["https://coffee-api.example.test"]
    assert config.CORS_ALLOW_ALL_ORIGINS is False
    assert config.CORS_ALLOW_CREDENTIALS is False
    database = config.DATABASES["default"]
    assert database["ENGINE"] == "django.db.backends.postgresql"
    assert database["CONN_MAX_AGE"] == 0
    assert database["DISABLE_SERVER_SIDE_CURSORS"] is True
    assert database["OPTIONS"]["sslmode"] == "require"
    assert database["OPTIONS"]["channel_binding"] == "require"
    assert database["OPTIONS"]["connect_timeout"] == 10


@pytest.mark.parametrize("stage", ["", "local", "prod"])
def test_vercel_requires_explicit_application_environment(
    vercel_environment, monkeypatch, stage
):
    monkeypatch.setenv("COFFEE_ENVIRONMENT", stage)
    with pytest.raises(ImproperlyConfigured, match="COFFEE_ENVIRONMENT"):
        load_vercel_settings()


@pytest.mark.parametrize("platform_environment", ["preview", "development"])
def test_vercel_preview_cannot_enable_production_mode(
    vercel_environment, monkeypatch, platform_environment
):
    monkeypatch.setenv("COFFEE_ENVIRONMENT", "production")
    monkeypatch.setenv("VERCEL_ENV", platform_environment)
    with pytest.raises(ImproperlyConfigured, match="cannot use production"):
        load_vercel_settings()


@pytest.mark.parametrize(
    "host", ["*", ".vercel.app", "https://api.example.test", "a/b"]
)
def test_vercel_rejects_broad_or_invalid_host_allowlists(
    vercel_environment, monkeypatch, host
):
    monkeypatch.setenv("ALLOWED_HOSTS", host)
    with pytest.raises(ImproperlyConfigured, match="exact hostnames"):
        load_vercel_settings()


def test_vercel_does_not_inherit_localhost_defaults(vercel_environment, monkeypatch):
    monkeypatch.delenv("ALLOWED_HOSTS")
    monkeypatch.delenv("VERCEL_URL")
    with pytest.raises(ImproperlyConfigured, match="ALLOWED_HOSTS or VERCEL_URL"):
        load_vercel_settings()


@pytest.mark.parametrize("name", ["CORS_ALLOWED_ORIGINS", "CSRF_TRUSTED_ORIGINS"])
@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:5174",
        "https://*.vercel.app",
        "https://preview.example.test/checkout",
        "https://user:password@preview.example.test",
    ],
)
def test_vercel_rejects_unscoped_or_non_https_origins(
    vercel_environment, monkeypatch, name, origin
):
    monkeypatch.setenv(name, origin)
    with pytest.raises(ImproperlyConfigured):
        load_vercel_settings()


@pytest.mark.parametrize("mode", ["disable", "allow", "prefer"])
def test_vercel_rejects_postgresql_tls_downgrade(vercel_environment, monkeypatch, mode):
    monkeypatch.setenv(
        "DATABASE_URL", f"postgresql://test:test@db.example.test/coffee?sslmode={mode}"
    )
    with pytest.raises(ImproperlyConfigured, match="must require TLS"):
        load_vercel_settings()


def test_vercel_refuses_ephemeral_sqlite(vercel_environment, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:////tmp/coffee.sqlite3")
    with pytest.raises(ImproperlyConfigured, match="external PostgreSQL"):
        load_vercel_settings()


def test_vercel_refuses_filesystem_media(vercel_environment, monkeypatch):
    monkeypatch.setenv("MEDIA_STORAGE", "filesystem")
    with pytest.raises(ImproperlyConfigured, match="persistent MEDIA_STORAGE=s3"):
        load_vercel_settings()


def test_vercel_requires_actual_storage_integration(vercel_environment, monkeypatch):
    monkeypatch.setattr(base, "STORAGES", {})
    with pytest.raises(ImproperlyConfigured, match="Integrate COFFEE-41"):
        load_vercel_settings()


def test_vercel_accepts_actual_blob_storage(vercel_environment, monkeypatch):
    monkeypatch.setenv("MEDIA_STORAGE", "vercel_blob")
    monkeypatch.setattr(
        base,
        "STORAGES",
        {
            "default": {"BACKEND": "config.blob_storage.BlobStorage"},
            "staticfiles": {
                "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
            },
        },
    )
    assert load_vercel_settings().SERVE_MEDIA is False


def test_vercel_rejects_mismatched_blob_adapter(vercel_environment, monkeypatch):
    monkeypatch.setenv("MEDIA_STORAGE", "vercel_blob")
    with pytest.raises(ImproperlyConfigured, match="Integrate COFFEE-41"):
        load_vercel_settings()


@pytest.mark.parametrize("secret", ["YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY"])
@pytest.mark.parametrize("stage", ["preview", "staging"])
def test_nonproduction_refuses_payment_credentials(
    vercel_environment, monkeypatch, secret, stage
):
    monkeypatch.setenv("COFFEE_ENVIRONMENT", stage)
    monkeypatch.setenv(secret, "synthetic-not-a-real-credential")
    with pytest.raises(ImproperlyConfigured, match="Payments must remain unconfigured"):
        load_vercel_settings()


def test_production_preserves_separately_configured_payment_credentials(
    vercel_environment, monkeypatch
):
    monkeypatch.setenv("COFFEE_ENVIRONMENT", "production")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("YOOKASSA_SHOP_ID", "synthetic-shop")
    monkeypatch.setenv("YOOKASSA_SECRET_KEY", "synthetic-key")
    config = load_vercel_settings()
    assert config.YOOKASSA_SHOP_ID == "synthetic-shop"
    assert config.YOOKASSA_SECRET_KEY == "synthetic-key"


@pytest.fixture
def staging_test_payments(vercel_environment, monkeypatch):
    for name, value in {
        "VERCEL_ENV": "production",
        "YOOKASSA_STAGING_TEST_ENABLED": "True",
        "YOOKASSA_SHOP_ID": "123456",
        "YOOKASSA_SECRET_KEY": "test_synthetic-not-a-secret",
    }.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setattr(base, "YOOKASSA_API_BASE", "https://api.yookassa.ru/v3")
    monkeypatch.setattr(
        base,
        "YOOKASSA_RETURN_URL",
        "https://coffee-preview.example.test/checkout/result",
    )
    monkeypatch.setattr(base, "YOOKASSA_WEBHOOK_IP_CHECK", True)


def test_staging_test_payments_require_explicit_opt_in(vercel_environment):
    config = load_vercel_settings()
    assert config.YOOKASSA_STAGING_TEST_ENABLED is False
    assert config.YOOKASSA_TEST_ONLY is False


def test_staging_test_payments_enable_strict_provider_and_proxy(staging_test_payments):
    config = load_vercel_settings()
    assert config.YOOKASSA_TEST_ONLY is True
    assert config.YOOKASSA_WEBHOOK_IP_CHECK is True
    assert config.YOOKASSA_WEBHOOK_TRUST_VERCEL_PROXY is True


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("COFFEE_ENVIRONMENT", "preview"),
        ("COFFEE_ENVIRONMENT", "production"),
        ("VERCEL_ENV", "preview"),
        ("VERCEL_ENV", "development"),
        ("VERCEL", ""),
        ("YOOKASSA_SHOP_ID", ""),
        ("YOOKASSA_SHOP_ID", "not-a-shop-id"),
        ("YOOKASSA_SECRET_KEY", ""),
        ("YOOKASSA_SECRET_KEY", "live_synthetic-not-a-secret"),
        ("YOOKASSA_SECRET_KEY", "test_"),
    ],
)
def test_staging_test_payments_reject_unsafe_environment_or_credentials(
    staging_test_payments, monkeypatch, name, value
):
    monkeypatch.setenv(name, value)
    with pytest.raises(ImproperlyConfigured):
        load_vercel_settings()


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("YOOKASSA_API_BASE", "http://api.yookassa.ru/v3"),
        ("YOOKASSA_API_BASE", "https://attacker.example.test/v3"),
        ("YOOKASSA_WEBHOOK_IP_CHECK", False),
        ("YOOKASSA_RETURN_URL", "http://coffee-preview.example.test/checkout/result"),
        ("YOOKASSA_RETURN_URL", "https://attacker.example.test/checkout/result"),
        ("YOOKASSA_RETURN_URL", "https://coffee-preview.example.test/checkout"),
        (
            "YOOKASSA_RETURN_URL",
            "https://coffee-preview.example.test/checkout/result?order_id=wrong",
        ),
        (
            "YOOKASSA_RETURN_URL",
            "https://coffee-preview.example.test/checkout/result#fragment",
        ),
    ],
)
def test_staging_test_payments_reject_unsafe_provider_or_callback(
    staging_test_payments, monkeypatch, name, value
):
    monkeypatch.setattr(base, name, value)
    with pytest.raises(ImproperlyConfigured):
        load_vercel_settings()


def test_vercel_proxy_is_never_trusted_outside_platform(
    vercel_environment, monkeypatch
):
    monkeypatch.delenv("VERCEL")
    assert load_vercel_settings().YOOKASSA_WEBHOOK_TRUST_VERCEL_PROXY is False


def test_static_and_security_build_never_connects_to_database(
    vercel_environment, monkeypatch, tmp_path
):
    config = load_vercel_settings()
    connect = Mock(side_effect=AssertionError("Build must not connect to the database"))
    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", connect)
    with override_settings(
        **{
            name: value
            for name, value in vars(config).items()
            if name.isupper() and name not in {"STATIC_ROOT", "DATABASES"}
        },
        STATIC_ROOT=tmp_path,
    ):
        call_command("check", deploy=True, fail_level="ERROR", verbosity=0)
        call_command("collectstatic", interactive=False, verbosity=0)
    connect.assert_not_called()
    assert (tmp_path / "admin/css/base.css").is_file()


def test_explicit_vercel_wsgi_entrypoint(monkeypatch):
    monkeypatch.delenv("DJANGO_SETTINGS_MODULE", raising=False)
    application = object()
    factory = Mock(return_value=application)
    monkeypatch.setattr("django.core.wsgi.get_wsgi_application", factory)
    spec = importlib.util.spec_from_file_location(
        "config._vercel_wsgi_unit", BACKEND_ROOT / "config/vercel_wsgi.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.application is application
    factory.assert_called_once_with()


def test_vercel_entrypoint_refuses_development_settings(monkeypatch):
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    factory = Mock()
    monkeypatch.setattr("django.core.wsgi.get_wsgi_application", factory)
    spec = importlib.util.spec_from_file_location(
        "config._vercel_wsgi_unit", BACKEND_ROOT / "config/vercel_wsgi.py"
    )
    with pytest.raises(ImproperlyConfigured, match="requires DJANGO_SETTINGS_MODULE"):
        spec.loader.exec_module(importlib.util.module_from_spec(spec))
    factory.assert_not_called()
