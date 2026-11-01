"""Payment transport guards; all responses are synthetic, with no network calls."""

import json
from decimal import Decimal
from unittest.mock import MagicMock, Mock
from urllib.error import HTTPError

import pytest

from apps.payments import yookassa


@pytest.fixture
def configured_client(settings, monkeypatch):
    settings.YOOKASSA_SHOP_ID = "123456"
    settings.YOOKASSA_SECRET_KEY = "test_synthetic-not-a-secret"
    settings.YOOKASSA_TEST_ONLY = True
    transport = Mock()
    monkeypatch.setattr(yookassa, "urlopen", transport)
    return transport


@pytest.mark.parametrize("name", ["YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY"])
@pytest.mark.parametrize("value", ["", "  "])
@pytest.mark.parametrize("method", ["create", "get"])
def test_incomplete_configuration_never_calls_provider(
    configured_client, settings, name, value, method
):
    setattr(settings, name, value)
    with pytest.raises(yookassa.YooKassaError, match="not configured"):
        if method == "get":
            yookassa.get_payment("synthetic-payment")
        else:
            yookassa.create_payment(
                amount=Decimal("5.00"), order_id="order", description="Synthetic"
            )
    configured_client.assert_not_called()


@pytest.mark.parametrize("method", ["POST", "GET"])
@pytest.mark.parametrize("test_value", [False, None, "true", 1, True])
def test_test_mode_requires_boolean_provider_confirmation(
    configured_client, method, test_value
):
    response = MagicMock()
    response.__enter__.return_value.read.return_value = json.dumps(
        {"id": "synthetic-payment", "test": test_value}
    ).encode()
    configured_client.return_value = response
    if test_value is True:
        assert yookassa._request(method, "/payments")["test"] is True
    else:
        with pytest.raises(yookassa.YooKassaError, match="non-test payment"):
            yookassa._request(method, "/payments")


def test_legacy_mode_preserves_non_test_payment_response(configured_client, settings):
    settings.YOOKASSA_TEST_ONLY = False
    response = MagicMock()
    response.__enter__.return_value.read.return_value = b'{"test": false}'
    configured_client.return_value = response
    assert yookassa.get_payment("synthetic-payment") == {"test": False}


def test_provider_error_body_and_credentials_are_not_logged(configured_client, caplog):
    error = HTTPError(
        "https://api.yookassa.ru/v3/payments", 401, "Unauthorized", {}, None
    )
    error.read = Mock(return_value=b"sensitive provider error payload")
    configured_client.side_effect = error
    with pytest.raises(yookassa.YooKassaError):
        yookassa.get_payment("synthetic-payment")
    assert "sensitive provider error payload" not in caplog.text
    assert "test_synthetic-not-a-secret" not in caplog.text
    assert "Basic " not in caplog.text
    error.read.assert_not_called()
