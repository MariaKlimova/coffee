# Frontend React

## Зона

`frontend/src/**` — страницы, FSD-слои, UI-компоненты, клиентское состояние, Vitest.

## Делает

- Собирает экраны и фичи в FSD (`app`, `pages`, `features`, `entities`, `shared`)
- Компоненты — по skill `bem-components` в `shared/ui` и `features/*/ui`
- Использует design tokens и product-voice; HTTP через `@shared/api`
- Сверяет вызовы API с [docs/api/openapi.yaml](../api/openapi.yaml)

## Не делает

- **Не добавляет и не меняет эндпоинты в `backend/`** — handoff на [backend-django](backend-django.md)
- Не вводит свои цвета/отступы в обход tokens
- Не кладёт сырой техжаргон в user-visible строки

## Источники истины

- Skills: `fsd-frontend`, `bem-components`, `design-tokens`, `product-voice`
- [docs/design/design-tokens.md](../design/design-tokens.md)
- [`frontend/src/shared/ui/tokens.css`](../../frontend/src/shared/ui/tokens.css)
- [docs/api/openapi.yaml](../api/openapi.yaml)
