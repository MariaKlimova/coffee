"""Explicit confirmation for admin lifecycle actions; order status stays readonly."""

from django import forms


class OrderTransitionForm(forms.Form):
    expected_status = forms.CharField(widget=forms.HiddenInput)
    request_id = forms.UUIDField(widget=forms.HiddenInput)
    to_status = forms.ChoiceField(label="Новый статус")
    comment = forms.CharField(
        label="Комментарий", max_length=500, required=False, widget=forms.Textarea
    )
    confirm = forms.BooleanField(
        label="Подтверждаю переход. Отмена заказа не возвращает деньги."
    )

    def __init__(self, *args, allowed_choices, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["to_status"].choices = allowed_choices
