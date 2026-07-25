"""HTTP views for the project config package."""

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Liveness probe used by local setup and infrastructure checks."""

    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request: Request) -> Response:
        """Return a simple OK payload."""
        return Response({"status": "ok"})
