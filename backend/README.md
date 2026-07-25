# Backend

Django + Django REST Framework API для Coffee Shop.

## Локальный запуск

См. корневой [README.md](../README.md) (Docker Compose или native).

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

