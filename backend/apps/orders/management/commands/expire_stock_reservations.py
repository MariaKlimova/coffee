"""Drain expired stock reservations; safe for an optional periodic scheduler."""

from django.core.management.base import BaseCommand

from apps.orders.services import expire_stock_reservations


class Command(BaseCommand):
    help = "Release expired unpaid stock reservations (idempotent, no refunds)."

    def handle(self, *args, **options):
        total = 0
        while count := expire_stock_reservations():
            total += count
        self.stdout.write(f"Released {total} expired reservations.")
