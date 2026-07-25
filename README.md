# Coffee Shop

[![backend-ci](https://github.com/MariaKlimova/coffee/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/MariaKlimova/coffee/actions/workflows/backend-ci.yml)
[![frontend-ci](https://github.com/MariaKlimova/coffee/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/MariaKlimova/coffee/actions/workflows/frontend-ci.yml)
[![commitlint](https://github.com/MariaKlimova/coffee/actions/workflows/commitlint.yml/badge.svg)](https://github.com/MariaKlimova/coffee/actions/workflows/commitlint.yml)

Интернет-магазин кофе и кофемашин.

## Стек

- **Backend:** Django + Django REST Framework + PostgreSQL
- **Frontend:** React + Vite

Подробнее: [docs/architecture.md](docs/architecture.md).

## Структура репозитория

```
coffee/
├── backend/      # Django API (TODO: COFFEE-4)
├── frontend/     # React SPA (TODO: COFFEE-5)
├── docs/
│   ├── architecture.md
│   ├── design/   # референсы и токены
│   └── api/      # OpenAPI-контракты
├── infra/        # Docker Compose и пр. (TODO: COFFEE-6)
├── .github/workflows/  # CI на каждый PR
├── CONTRIBUTING.md
└── README.md
```

## Локальный запуск

Пока скелеты приложений и Docker ещё не настроены. После соответствующих задач:

```bash
# TODO (COFFEE-4): backend
# cd backend && ...

# TODO (COFFEE-5): frontend
# cd frontend && npm install && npm run dev

# TODO (COFFEE-6): всё окружение через Docker Compose
# docker compose up
```

## CI

На каждый pull request в GitHub Actions:

| Workflow | Что проверяет |
|----------|----------------|
| `backend-ci` | ruff, black --check, pytest (после COFFEE-4) |
| `frontend-ci` | lint, typecheck, test, build (после COFFEE-5) |
| `commitlint` | Conventional Commits в истории PR |

Пока скелеты backend/frontend не готовы, соответствующие джобы пропускают шаги и остаются зелёными.

## Ветка `main`

Прямой push в `main` запрещён (в том числе для админов): изменения только через pull request. Перед merge обязательны зелёные checks: `lint-format-test`, `lint-typecheck-test-build`, `conventional-commits`.

## Контрибьюция

Сообщения коммитов — [Conventional Commits](CONTRIBUTING.md); в корне стоят husky + commitlint.

```bash
npm install   # ставит зависимости и git-хуки (prepare → husky)
```
