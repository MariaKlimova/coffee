"""Admin permission policies for records owned by application services."""


class NoAddDeleteAdminMixin:
    """Keep service-created records and their history intact in admin."""

    actions = None

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ReadOnlyAdminMixin(NoAddDeleteAdminMixin):
    """Allow normal Django view permissions, but reject mutation requests."""

    def has_change_permission(self, request, obj=None):
        return False
