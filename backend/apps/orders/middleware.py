"""Traffic-driven expiry: works on serverless instances without a worker."""

from apps.orders.services import expire_stock_reservations


class StockReservationExpiryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith(
            ("/api/products/", "/api/cart/", "/api/orders/", "/api/payments/")
        ):
            expire_stock_reservations()
        return self.get_response(request)
