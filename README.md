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
│   ├── design/   # референсы и токены
│   └── api/      # OpenAPI-контракты
├── infra/        # Docker Compose и пр. (TODO: COFFEE-6)
├── .github/workflows/  # CI на каждый PR
├── CONTRIBUTING.md
└── README.md
```

## Локальный запуск

### Backend

Нужен PostgreSQL (локально или позже через COFFEE-6). Пример URL — в `backend/.env.example`.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env   # при необходимости поправьте DATABASE_URL
python manage.py migrate
python manage.py runserver
```

Проверка: `GET http://127.0.0.1:8000/api/health/` → `{"status": "ok"}`.  
OpenAPI: `http://127.0.0.1:8000/api/docs/`.

### Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_BASE_URL=http://127.0.0.1:8000
npm install
npm run dev
```

Dev-сервер: `http://localhost:5173`. Роуты-заглушки: `/`, `/coffee`, `/machines`, `/product/:id`, `/favorites`, `/cart`, `/login`, `/register`, `/checkout`.

При поднятом backend HTTP-клиент (`@shared/api`) ходит на `GET /api/health/`.

```bash
# TODO (COFFEE-6): всё окружение через Docker Compose
# docker compose up
```

## CI

На каждый pull request в GitHub Actions:

| Workflow | Что проверяет |
|----------|----------------|
| `backend-ci` | ruff, black --check, pytest (+ Postgres service) |
| `frontend-ci` | lint, typecheck, test, build |
| `commitlint` | Conventional Commits в истории PR |


## Ветка `main`

Прямой push в `main` запрещён (в том числе для админов): изменения только через pull request. Перед merge обязательны зелёные checks: `lint-format-test`, `lint-typecheck-test-build`, `conventional-commits`.

## Контрибьюция

Сообщения коммитов — [Conventional Commits](CONTRIBUTING.md); в корне стоят husky + commitlint.

```bash
npm install   # ставит зависимости и git-хуки (prepare → husky)
```
