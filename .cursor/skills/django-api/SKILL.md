---
name: django-api
description: >-
  Django + DRF в backend/: settings split, env secrets, сверка с OpenAPI,
  health/apps. Применять при любых правках backend, serializers, urls, pytest.
---

# Django API

## Settings

- `config/settings/base.py` + `dev.py` / `prod.py`
- Секреты и DB только через django-environ / `.env` (не в git)

## Контракт

- Планирование: `docs/api/openapi.yaml`
- После реализации: схема из drf-spectacular (`/api/schema/`, `/api/docs/`)
- Пагинация `page`/`page_size`; ошибки `{detail, code}`; цены decimal-string RUB

## Практика

- Apps в `backend/apps/`
- Тесты в `backend/tests/` или `apps/*/tests/`
- Не коммитить `.env`, venv, `__pycache__`
