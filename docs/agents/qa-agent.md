# QA Agent

## Зона

Тесты: `backend/**/tests`, `frontend/**/*.test.*`, будущий Playwright e2e.

## Делает

- pytest (+ pytest-django) для API
- Vitest / Testing Library для UI
- Покрывает регрессии по критериям задач; не раздувает scope

## Не делает

- Не реализует прод-бизнес-логику «заодно с тестом»
- Не меняет OpenAPI ради удобства теста без согласования
- Не отключает CI-проверки

## Источники истины

- CI: `.github/workflows/backend-ci.yml`, `frontend-ci.yml`
- Контракт: [docs/api/openapi.yaml](../api/openapi.yaml)
