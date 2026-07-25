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
├── backend/      # Django + DRF API
├── frontend/     # React + Vite SPA (FSD)
├── docs/
│   ├── architecture.md
│   ├── agents/   # роли Cursor-агентов
│   ├── design/   # tokens (stub) и референсы
│   ├── content/  # glossary / copy
│   └── api/      # OpenAPI-контракт (openapi.yaml)
├── .cursor/      # rules, skills, Code Review, BUGBOT
├── infra/        # Docker Compose
├── AGENTS.md
├── CONTRIBUTING.md
└── README.md
```

## Локальный запуск

### Docker Compose (рекомендуется)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev
```

Если `backend/.env` уже есть — сверь `SECRET_KEY` с `.env.example` (нужен ≥50 символов, иначе PyJWT/Django ругаются). `cp` сам старый файл не обновит.

| Команда | Что делает |
|---------|------------|
| `npm run dev` | `up --build` |
| `npm run dev:down` | остановить контейнеры |
| `npm run dev:reset` | `down -v` + `up --build` (чистая БД) |

Эквивалент без npm:

```bash
docker compose -f infra/docker-compose.yml up --build
```

| Сервис | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://127.0.0.1:8000 |
| Health | http://127.0.0.1:8000/api/health/ |
| OpenAPI | http://127.0.0.1:8000/api/docs/ |
| Postgres | localhost:5432 |

Код монтируется volume'ами: правки в `backend/` и `frontend/` подхватываются без пересборки образа.

В `backend/.env` для Docker хост БД — `db`. Для нативного запуска backend замените на `localhost`.

### Backend (без Docker)

Нужен PostgreSQL. В `.env` укажите `DATABASE_URL=postgres://coffee:coffee@localhost:5432/coffee`.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env   # поправьте DATABASE_URL на localhost
python manage.py migrate
python manage.py runserver
```

### Frontend (без Docker)

```bash
cd frontend
cp .env.example .env   # VITE_API_BASE_URL=http://127.0.0.1:8000
npm install
npm run dev
```

Роуты-заглушки: `/`, `/coffee`, `/machines`, `/product/:id`, `/favorites`, `/cart`, `/login`, `/register`, `/checkout`.

## CI

На каждый pull request в GitHub Actions:

| Workflow | Что проверяет |
|----------|----------------|
| `backend-ci` | ruff, black --check, pytest (+ Postgres service) |
| `frontend-ci` | lint, typecheck, test, build |
| `commitlint` | Conventional Commits в истории PR |

## Ветка `main`

Прямой push в `main` запрещён (в том числе для админов): изменения только через pull request. Перед merge обязательны зелёные checks: `lint-format-test`, `lint-typecheck-test-build`, `conventional-commits`.

## Как работать с агентами в Cursor

Карта ролей и handoff: [AGENTS.md](AGENTS.md).  
Описание каждой роли: [docs/agents/](docs/agents/).

| Инструмент | Путь |
|------------|------|
| Rules | `.cursor/rules/` |
| Skills (bem, product-voice, tokens, django, fsd) | `.cursor/skills/` |
| Code Review subagent | `.cursor/agents/code-review.md` (`/code-review`) |
| Контракт findings | `.cursor/BUGBOT.md` |

Пример: задача «добавь эндпоинт» для frontend-агента → отказ и handoff на [backend-django](docs/agents/backend-django.md).

## Контрибьюция

Сообщения коммитов — [Conventional Commits](CONTRIBUTING.md); в корне стоят husky + commitlint.

```bash
npm install   # ставит зависимости и git-хуки (prepare → husky)
```
