"""Capability migration never assigns ownership or fabricates historical actions."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_buyer_cancellation_migration_preserves_legacy_and_reverses_cleanly():
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [
        (app, "0003_order_status_workflow" if app == "orders" else name)
        for app, name in latest
    ]
    executor.migrate(previous)
    try:
        historical = executor.loader.project_state(previous).apps
        Order = historical.get_model("orders", "Order")
        order = Order.objects.create(
            status="paid",
            reservation_state="none",
            total_amount="7.00",
            delivery_address="Synthetic migration71",
        )
        Payment = historical.get_model("payments", "Payment")
        payment = Payment.objects.create(
            order=order,
            amount="7.00",
            status="succeeded",
            provider_payment_id="migration71-synthetic",
        )
        before = list(Payment.objects.filter(pk=payment.pk).values())
        executor = MigrationExecutor(connection)
        executor.migrate(latest)
        current = executor.loader.project_state(latest).apps
        migrated = current.get_model("orders", "Order").objects.get(pk=order.pk)
        assert migrated.status == "paid" and migrated.reservation_state == "none"
        assert (
            migrated.checkout_request_id is None
            and migrated.guest_action_digest == ""
            and migrated.checkout_proof_digest == ""
            and migrated.guest_action_version == 0
        )
        assert current.get_model("orders", "CancellationRequest").objects.count() == 0
        assert current.get_model("orders", "OrderActionIntent").objects.count() == 0
        assert current.get_model("orders", "OrderStatusTransition").objects.count() == 0
        assert (
            list(
                current.get_model("payments", "Payment")
                .objects.filter(pk=payment.pk)
                .values()
            )
            == before
        )
        executor = MigrationExecutor(connection)
        executor.migrate(previous)
        restored = (
            executor.loader.project_state(previous)
            .apps.get_model("orders", "Order")
            .objects.get(pk=order.pk)
        )
        assert restored.status == "paid" and restored.reservation_state == "none"
    finally:
        MigrationExecutor(connection).migrate(latest)
