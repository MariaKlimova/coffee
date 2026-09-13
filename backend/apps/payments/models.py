"""Payment model — provider session linked to an order."""

import uuid

from django.db import models


class Payment(models.Model):
    """
    One payment attempt for an order via an external provider (YooKassa).

    Multiple rows per order are allowed so the buyer can retry after
    ``failed`` / ``canceled``. At most one ``succeeded`` payment should exist
    per order (enforced in services).
    """

    class Status(models.TextChoices):
        """Lifecycle mirrored from the payment provider."""

        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="payments",
    )
    provider_payment_id = models.CharField(max_length=64, unique=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    confirmation_url = models.URLField(max_length=512, blank=True, default="")
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "payment"
        verbose_name_plural = "payments"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["order"],
                condition=models.Q(status="succeeded"),
                name="payments_payment_one_succeeded_per_order",
            ),
        ]

    def __str__(self) -> str:
        return f"Payment({self.id}, {self.status})"
