"""Exact COFFEE-64 created IDs; never classify by slug/name/category.

Import run catalog-data-20261101T123258089703Z created these 18 rows.
The repeated run created none; existing matching products are excluded.
"""

from django.db import migrations

DEMO_IDS = (
    "082b798d-6647-4c02-af0e-328aa48074e9",
    "2de2d6b5-5abd-4234-be9e-0b004ede4370",
    "53cbeb2d-4204-497a-84f3-24cc66c0a88d",
    "41406f8c-cc76-4658-92e7-66f82524d1a3",
    "c7577a57-d476-4abc-bf87-0ae2ef7c0b4e",
    "88eb8d68-be3f-4436-b3b6-dcf829ffb572",
    "efb0b36d-ea84-4b27-adcb-70eadb5d1e24",
    "0956ec8b-2f1e-4e86-9418-7c521514e62d",
    "e526703e-a0d2-458e-974f-91b27190fc09",
    "fec32e94-fdde-4dd6-9227-836adf58a30f",
    "ef79497f-acc6-4a8f-b685-6da31ae07d52",
    "05930229-3c3d-4d4c-8e62-63ade9588728",
    "3f759865-80fe-4da3-90a9-04fdc7c47f5f",
    "8305f13f-f7ee-4ca4-9dce-d7ca492ac321",
    "5aef8146-db24-4692-82ea-45bc4eaa7173",
    "c570cc12-2e71-4d0f-9169-281c75cb65fe",
    "5ef06f23-1b8d-4981-b942-bfa57bbf5c82",
    "8fb82e67-3610-4f75-95bd-86ebbd0b0d85",
)


def import_provenance(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")
    Product.objects.filter(pk__in=DEMO_IDS).update(
        origin="demo", demo_source="catalog-data-20261101T123258089703Z"
    )
    apps.get_model("catalog", "CatalogState").objects.get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [("catalog", "0005_product_demo_source_product_origin_and_more")]
    operations = [migrations.RunPython(import_provenance, migrations.RunPython.noop)]
