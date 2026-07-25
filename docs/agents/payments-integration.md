# Payments Integration

## Зона

`backend/apps/payments/**` (когда появится) — создание платежа, webhook, статусы заказа.

## Делает

- Идемпотентные webhook-обработчики
- Синхронизация статуса платежа ↔ заказа по контракту OpenAPI
- Секреты провайдера только из env; маскирование в логах

## Не делает

- Не пишет frontend UI checkout
- Не логирует полные токены / карты / raw webhook с PII без необходимости
- Не меняет каталог/auth вне платежей без согласования

## Источники истины

- [docs/api/openapi.yaml](../api/openapi.yaml) (Payments)
- [security-reviewer](security-reviewer.md)
- Skill: `.cursor/skills/django-api/SKILL.md`
