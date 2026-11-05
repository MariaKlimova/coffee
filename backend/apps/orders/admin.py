"""Django admin for orders."""

from uuid import uuid4

from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.decorators import method_decorator
from django.utils.html import format_html
from django.views.decorators.http import require_http_methods
from rest_framework.exceptions import APIException

from apps.orders.admin_forms import OrderTransitionForm
from apps.orders.models import Order, OrderItem, OrderStatusTransition
from apps.orders.workflow import allowed_order_transitions, transition_order
from config.admin import NoAddDeleteAdminMixin, ReadOnlyAdminMixin


class OrderItemInline(ReadOnlyAdminMixin, admin.TabularInline):
    """Inline line snapshots on the order change page."""

    model = OrderItem
    extra = 0
    readonly_fields = (
        "id",
        "product",
        "product_name",
        "product_price",
        "quantity",
    )


class OrderStatusTransitionInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = OrderStatusTransition
    extra = 0
    fields = (
        "created_at",
        "from_status",
        "to_status",
        "source",
        "actor_label",
        "comment",
    )
    readonly_fields = fields

    def has_view_permission(self, request, obj=None):
        return request.user.has_perm("orders.view_order") or request.user.has_perm(
            "orders.change_order"
        )


@admin.register(Order)
class OrderAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    """Browse orders by user, guest contact, or status."""

    list_display = (
        "id",
        "user",
        "guest_email",
        "status",
        "total_amount",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "id",
        "user__email",
        "guest_email",
        "guest_phone",
        "delivery_address",
    )
    # Status changes use the separate validated workflow form. Deleting the
    # parent would also cascade its protected lines and financial/audit history.
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "total_amount",
        "status",
        "reservation_state",
        "reservation_expires_at",
        "stock_review_reason",
        "workflow_actions",
    )
    inlines = [OrderItemInline, OrderStatusTransitionInline]

    @admin.display(description="Обработка заказа")
    def workflow_actions(self, obj):
        url = reverse("admin:orders_order_transition", args=[obj.pk])
        return format_html('<a href="{}">Переход статуса и история</a>', url)

    def save_model(self, request, obj, form, change):
        # A contact form opened before a concurrent transition must never write
        # its stale readonly status/reservation fields back to the database.
        obj.save(
            update_fields=[
                "user",
                "guest_email",
                "guest_phone",
                "delivery_address",
                "updated_at",
            ]
        )

    def get_urls(self):
        return [
            path(
                "<uuid:object_id>/transition/",
                self.admin_site.admin_view(self.transition_view),
                name="orders_order_transition",
            ),
        ] + super().get_urls()

    @method_decorator(require_http_methods(["GET", "POST"]))
    def transition_view(self, request, object_id):
        order = self.get_object(request, str(object_id))
        if order is None:
            raise Http404
        if not self.has_change_permission(request, order):
            raise PermissionDenied
        actions = allowed_order_transitions(order)
        # A stale POST is validated by the service, including expected-status
        # and idempotency guards; GET offers only currently allowed actions.
        choices = (
            Order.Status.choices
            if request.method == "POST"
            else [
                (action["to_status"], Order.Status(action["to_status"]).label)
                for action in actions
            ]
        )
        form = OrderTransitionForm(
            request.POST if request.method == "POST" else None,
            allowed_choices=choices,
            initial={"expected_status": order.status, "request_id": uuid4()},
        )
        status_code = 200
        if request.method == "POST":
            if form.is_valid():
                data = {
                    key: value
                    for key, value in form.cleaned_data.items()
                    if key != "confirm"
                }
                try:
                    transition_order(order_id=order.pk, actor=request.user, **data)
                except APIException as exc:
                    form.add_error(None, str(exc.detail))
                    status_code = exc.status_code
                else:
                    self.message_user(
                        request, "Статус заказа сохранён.", messages.SUCCESS
                    )
                    return HttpResponseRedirect(
                        reverse("admin:orders_order_change", args=[order.pk])
                    )
            else:
                status_code = 400
        form.fields["to_status"].choices = [
            (action["to_status"], Order.Status(action["to_status"]).label)
            for action in actions
        ]
        return TemplateResponse(
            request,
            "admin/orders/order/transition.html",
            {
                **self.admin_site.each_context(request),
                "opts": self.model._meta,
                "original": order,
                "title": "Обработка заказа",
                "form": form,
                "allowed_actions": actions,
                "history": order.status_history.all(),
            },
            status=status_code,
        )


@admin.register(OrderItem)
class OrderItemAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Browse individual order lines."""

    list_display = (
        "id",
        "order",
        "product_name",
        "product_price",
        "quantity",
        "product",
    )
    search_fields = ("product_name", "order__id")
    readonly_fields = (
        "id",
        "order",
        "product",
        "product_name",
        "product_price",
        "quantity",
    )


@admin.register(OrderStatusTransition)
class OrderStatusTransitionAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "order",
        "created_at",
        "from_status",
        "to_status",
        "source",
        "actor_label",
    )
