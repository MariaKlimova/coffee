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

## Аутентификация на фронте

Слой `entities/user` хранит сессию; HTTP-клиент в `shared/api` получает токены через dependency bridge (`AuthBridge`), чтобы `shared` не импортировал `entities`.

| Что | Где |
|-----|-----|
| Access token | Только в памяти (Zustand `authStore`) |
| Refresh token | Память + `localStorage` (`coffee.refresh_token`) |
| Текущий пользователь | Zustand `user` / `status` |

Поток:

1. При старте `AuthProvider` вызывает `restoreSession()` → `GET /api/auth/me/`.
2. После F5 access-токена нет → `/me/` отвечает 401 → интерцептор делает `POST /api/auth/refresh/` (single-flight на параллельные 401), сохраняет новый access и повторяет исходный запрос.
3. Если refresh не удался: сессия очищается. Редирект на `/login` только при mid-session expiry (`status === 'authenticated'`); soft-restore на F5 со stale token остаётся на текущей публичной странице. Приватные роуты по-прежнему закрывает `RequireAuth`.
4. `RequireAuth` закрывает `/favorites`, `/checkout`, `/profile`; `/cart` доступен гостю. Исходный путь сохраняется в `location.state.from` для возврата после логина (формы — COFFEE-17).

**SECURITY (MVP):** refresh token в `localStorage` читается любым скриптом на origin (XSS). В проде стоит перейти на httpOnly cookie, когда бэкенд это поддержит (см. COFFEE-16).

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
