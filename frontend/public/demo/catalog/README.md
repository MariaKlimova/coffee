# Иллюстрации демонстрационного каталога

Статические изображения для нового staging frontend, созданные 01.11.2026.
Это нейтральные моковые иллюстрации, а не фото реальных SKU. Одна иллюстрация
повторяется у девяти демо-позиций каждой категории; модель кофемашины на картинке
не подтверждает характеристики конкретного товара.

Режим генерации: `built-in image_gen.imagegen`, новая генерация (без референса).
Исходные PNG 1254×1254 сохранены вне Git в runtime COFFEE-64. Для веба только
уменьшены до 768×768 и сжаты Pillow в WebP, quality82/method6 без обрезки.

- `frontend/public/demo/catalog/coffee.webp` — 24622 байта.
- `frontend/public/demo/catalog/machine.webp` — 32032 байта.

Resolver `entities/product/lib/resolveProductImages.ts` использует эти ресурсы
только при `VITE_ENABLE_DEMO_CATALOG_IMAGES=true` и только для 18 UUID записей,
созданных staging-импортом `catalog-data-20261101T123258089703Z` из ревизии
`8b59e4704753459ce46af487dd53ef033e179e83`. Список UUID зафиксирован в
`frontend/src/entities/product/lib/demoCatalogImages.const.ts`. Другие товары не получают подстановку по названию,
slug или категории. Реальная галерея и обложка всегда приоритетны.
По умолчанию флаг выключен. Его включают только в новом `coffee-shop-staging`,
а API и query cache сохраняют исходные пустые image_url/images.

Это не upload в S3 и не доказательство исправления Neon storage. Приёмка
сохранения настоящих фото остаётся заблокированной. Будущий переход с демо на
каталог владельца относится к задачам админки; переключателя здесь нет.

Это временная подстановка для COFFEE-64. В COFFEE-42/45/46 её нужно заменить
серверным происхождением и состоянием товара либо убрать вместе с выключением
демо-каталога. Перевод прежнего демо-UUID в рабочий товар без фото не должен
сохранять мок. Будущий переключатель в админке не должен зависеть от пересборки
frontend или изменения VITE-переменной.

## Финальные промпты

### coffee-original.png

Use case: product-mockup. Asset type: square ecommerce demo catalog image for a coffee shop. Primary request: a tasteful generic bag of roasted specialty coffee beans, unbranded matte kraft paper pouch with blank label, a small neat scattering of dark brown coffee beans next to the pouch. Clean studio product photography, warm ivory seamless backdrop, soft natural shadows, front three-quarter view, entire pouch fully visible with generous margin for square card cropping, centered composition. Photorealistic materials and detail, understated aesthetic, no readable text, no logos, no watermark, no decorative frame. This is placeholder imagery for demo products, not a depiction of a real branded product.

### machine-original.png

Use case: product-mockup. Asset type: square ecommerce demo catalog image for a coffee shop. Primary request: a generic compact home espresso coffee machine, elegant brushed stainless steel with understated charcoal details, portafilter attached, one simple white espresso cup on drip tray. No brand identity. Clean studio product photograph on warm ivory seamless backdrop, soft natural shadows, front three-quarter view, entire machine fully visible with generous margins for square card cropping, centered composition. Photorealistic material and realistic proportions, understated modern aesthetic. No logos, no readable text, no watermark, no decorative frame, no people. This is neutral placeholder imagery for demo coffee-machine products, not an exact depiction of any real branded model.
