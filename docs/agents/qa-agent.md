# QA: тесты и независимая приёмка

## Зона

Тесты: `backend/tests/`, `backend/**/tests`, `frontend/**/*.test.*`.
QA Tester принимает поведение отдельно от реализации и code review.

## Делает

- pytest (+ pytest-django) для API
- Vitest / Testing Library для UI
- Покрывает регрессии по критериям задач; не раздувает scope
- Для приёмки использует [coffee-qa](../../.cursor/skills/coffee-qa/SKILL.md)
  и [роль QA Tester](../../.cursor/agents/qa-tester.md): актуальные AC Jira,
  snapshot ревизии, сценарии API/UI/browser, evidence, PASS/FAIL/BLOCKED
- Публикует обязательный QA-комментарий в COFFEE-N, подтверждает comment ID/ссылку;
  отсутствие upload не отменяет текстовый отчёт

## Не делает

- Не реализует прод-бизнес-логику «заодно с тестом»
- Не меняет OpenAPI ради удобства теста без согласования
- Не отключает CI-проверки
- При приёмке не исправляет продуктовый код, тесты и конфигурацию; дефекты
  возвращает исполнителю. Авторские тесты добавляются на этапе реализации
- Не выдаёт jsdom/mock за браузер или реальную оплату; не меняет реальные
  заказы/платежи, Jira-статус/assignee и не создаёт bug-тикеты

## Источники истины

- CI: `.github/workflows/backend-ci.yml`, `frontend-ci.yml`
- Контракт: [docs/api/openapi.yaml](../api/openapi.yaml)
