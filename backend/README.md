# Backend

Django + Django REST Framework API для Coffee Shop.

## Локальный запуск

См. корневой [README.md](../README.md) (Docker Compose или native).

Постоянные изображения, S3 / Vercel Blob environment и ручной безопасный seed:
[`docs/media-storage.md`](../docs/media-storage.md).

## API-контракт

Черновой OpenAPI-контракт (планирование Epic 2–7):

[`docs/api/openapi.yaml`](../docs/api/openapi.yaml)

После реализации реальных эндпоинтов **источником истины** становится схема,
сгенерированная **drf-spectacular** из кода:

- JSON Schema: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`

Файл `docs/api/openapi.yaml` — стартовая точка для согласования контракта между
backend и frontend, а не вечный источник истины. При расхождении с кодом
Проверка черновика:

```bash
npx @redocly/cli@1 lint docs/api/openapi.yaml --config docs/api/redocly.yaml
```

## Отдельный стенд Vercel + Neon

Packaging backend-проекта и порядок переноса описаны в
[runbook](../docs/deployment/vercel-neon.md). Использовать корень `backend/` и
`config.settings.vercel`; корневой Vercel-проект frontend не перенастраивать.
Миграции и demo seed запускаются явно, отдельно от сборки и обработки запросов.

Количественный учёт, ручное первоначальное заполнение и cleanup резерва:
[docs/inventory.md](../docs/inventory.md).
