"""Auth API views: register, login, refresh, logout, me."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.serializers import (
    AuthTokensSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserSerializer,
    tokens_for_user,
)

ErrorSerializer = inline_serializer(
    name="Error",
    fields={
        "detail": serializers.CharField(),
        "code": serializers.CharField(),
        "errors": serializers.DictField(
            child=serializers.ListField(child=serializers.CharField()),
            required=False,
        ),
    },
)

RefreshResponseSerializer = inline_serializer(
    name="RefreshResponse",
    fields={"access": serializers.CharField()},
)


class RegisterView(APIView):
    """POST /api/auth/register/ — create user and return JWT pair."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        request=RegisterSerializer,
        responses={
            201: AuthTokensSerializer,
            400: ErrorSerializer,
        },
        auth=[],
    )
    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = AuthTokensSerializer(tokens_for_user(user)).data
        return Response(payload, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST /api/auth/login/ — exchange credentials for JWT pair."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        request=LoginSerializer,
        responses={
            200: AuthTokensSerializer,
            401: ErrorSerializer,
        },
        auth=[],
    )
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        payload = AuthTokensSerializer(tokens_for_user(user)).data
        return Response(payload, status=status.HTTP_200_OK)


class RefreshView(TokenRefreshView):
    """POST /api/auth/refresh/ — new access token from refresh."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        responses={
            200: RefreshResponseSerializer,
            401: ErrorSerializer,
        },
        auth=[],
    )
    def post(self, request: Request, *args, **kwargs) -> Response:
        return super().post(request, *args, **kwargs)


class LogoutView(APIView):
    """POST /api/auth/logout/ — blacklist the refresh token."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        request=LogoutSerializer,
        responses={
            204: None,
            400: ErrorSerializer,
            401: ErrorSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = RefreshToken(serializer.validated_data["refresh"])
            token.blacklist()
        except TokenError:
            return Response(
                {
                    "detail": "Token is invalid or expired.",
                    "code": "token_not_valid",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /api/auth/me/ — current authenticated user."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        responses={
            200: UserSerializer,
            401: ErrorSerializer,
        },
    )
    def get(self, request: Request) -> Response:
        return Response(UserSerializer(request.user).data)
