# Архитектура

Интернет-магазин кофе и кофемашин. Монорепозиторий: backend (Django) и frontend (React) в одном репозитории.

## Стек

| Слой | Технологии |
|------|------------|
| Backend | Django, Django REST Framework, PostgreSQL |
| Frontend | React, Vite |
| Инфра | Docker Compose (локально), CI на PR |

## Структура репозитория

```
coffee/
├── backend/     # Django + DRF API
├── frontend/    # React + Vite SPA
├── docs/        # Архитектура, дизайн, API-контракты
│   ├── design/
│   └── api/
└── infra/       # Docker и прочая инфраструктура
```

## Поток данных

```
React (Vite)  →  HTTP/JSON  →  Django REST Framework  →  PostgreSQL
```

Клиент ходит на API backend. CORS настроен для локальной разработки (Vite на `localhost:5173`). Контракт API описывается в OpenAPI (черновик в `docs/api/`, схема генерируется из DRF).

## Эпики инфраструктуры

Базовый фундамент (Epic 0):

- инициализация монорепо (этот репозиторий)
- скелет Django (`backend/`)
- скелет React (`frontend/`)
- Docker Compose
- CI: lint + tests
- черновой OpenAPI-контракт
- правила для агентов Cursor

Дальше — дизайн-система, каталог, корзина, заказы и остальные продуктовые эпики.
