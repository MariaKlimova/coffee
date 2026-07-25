# AGENTS — Coffee Shop

Роли для Cursor-агентов и handoff между задачами.

## Роли

| Агент | Зона | Документ |
|-------|------|----------|
| **Backend Django** | `backend/**` | [docs/agents/backend-django.md](docs/agents/backend-django.md) |
| **Frontend React** | `frontend/src/**` | [docs/agents/frontend-react.md](docs/agents/frontend-react.md) |
| **Payments** | `backend/apps/payments/**` | [docs/agents/payments-integration.md](docs/agents/payments-integration.md) |
| **Design Guardian** | ревью UI vs tokens | [docs/agents/design-guardian.md](docs/agents/design-guardian.md) |
| **Copywriter** | тексты, glossary | [docs/agents/copywriter.md](docs/agents/copywriter.md) |
| **QA** | тесты | [docs/agents/qa-agent.md](docs/agents/qa-agent.md) |
| **Security Reviewer** | auth/secrets/XSS/CSRF | [docs/agents/security-reviewer.md](docs/agents/security-reviewer.md) |

## Handoff

- **UI / компоненты:** Frontend React + skills `bem-components`, `fsd-frontend`, `design-tokens`, `product-voice`
- **API / Django:** Backend Django + skill `django-api` + сверка с [docs/api/openapi.yaml](docs/api/openapi.yaml)
- **Платежи:** Payments + Security Reviewer
- **Запрет:** Frontend React **не** добавляет эндпоинты в `backend/` — handoff на Backend Django
- **Запрет:** Design Guardian / Security Reviewer / Copywriter **не** пишут фичи без явной просьбы (ревью / тексты / замечания)

## Стек

- `backend/` — Django + DRF + PostgreSQL
- `frontend/` — React + Vite + TypeScript, FSD
- Состояние: Zustand + TanStack Query
- Контракт API: `docs/api/openapi.yaml` → позже drf-spectacular

## Skills

См. `.cursor/skills/` — `bem-components`, `product-voice`, `design-tokens`, `django-api`, `fsd-frontend`.

## Subagents

| Subagent | Файл | Когда |
|----------|------|--------|
| **Code Review** | [`.cursor/agents/code-review.md`](.cursor/agents/code-review.md) | ревью PR/diff, `/code-review`, после крупной задачи |

**Handoff Code Review → пользователь:** главный агент **не пересказывает** и **не сжимает** ответ Code Review. В чат уходит финальный markdown subagent’а целиком (включая «Сводка», «Все findings», категорийные таблицы, «Чистота кода»). Допустимо лишь короткое вступление («ревью готово») + ссылка на subagent.

Остальные роли живут через **docs/agents + skills + rules**; Code Review подхватывает их правила по зонам diff из `.cursor/BUGBOT.md`.

## Источники истины

- Архитектура: [docs/architecture.md](docs/architecture.md)
- API: [docs/api/openapi.yaml](docs/api/openapi.yaml)
- Design tokens (stub → Epic 1): [docs/design/design-tokens.md](docs/design/design-tokens.md)
- Glossary / тон: [docs/content/glossary.md](docs/content/glossary.md)
