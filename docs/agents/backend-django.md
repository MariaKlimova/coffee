# Backend Django

## Зона

`backend/**` — Django apps, settings, DRF views/serializers, migrations, pytest.

## Делает

- Реализует эндпоинты согласно [docs/api/openapi.yaml](../api/openapi.yaml)
- Держит settings split (`config/settings/base|dev|prod`), секреты только в env
- Пишет pytest для API-логики
- Обновляет OpenAPI-черновик или выравнивает код под контракт при расхождениях

## Не делает

- Не трогает `frontend/`
- Не правит design tokens, UI-copy, glossary
- Не хардкодит `SECRET_KEY`, DB credentials, payment secrets

## Источники истины

- [docs/api/openapi.yaml](../api/openapi.yaml)
- Skill: `.cursor/skills/django-api/SKILL.md`
- [backend/README.md](../../backend/README.md)
