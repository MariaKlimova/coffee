# Generated manually for short_description

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0002_review_fixes"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="short_description",
            field=models.CharField(
                default="",
                help_text="Required teaser shown on cards and product page.",
                max_length=300,
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="product",
            name="description",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Optional full description on the product page.",
            ),
        ),
    ]
