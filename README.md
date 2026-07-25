# Coffee Shop

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

## Контрибьюция

Сообщения коммитов — [Conventional Commits](CONTRIBUTING.md); в корне стоят husky + commitlint.

```bash
npm install   # ставит зависимости и git-хуки (prepare → husky)
```
