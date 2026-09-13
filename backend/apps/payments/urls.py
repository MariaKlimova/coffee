"""URL routes for the payments API."""

from django.urls import path

from apps.payments.views import PaymentCreateView, PaymentWebhookView

urlpatterns = [
    path(
        "payments/create/",
        PaymentCreateView.as_view(),
        name="payment-create",
    ),
    path(
        "payments/webhook/",
        PaymentWebhookView.as_view(),
        name="payment-webhook",
    ),
]
