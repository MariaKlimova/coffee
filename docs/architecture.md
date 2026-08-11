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

## Каталог на фронте

Слой данных каталога живёт в `entities/product`; фильтры и URL-состояние — в `features/catalog`; композиция витрин `/coffee` и `/machines` — в `pages/CatalogPage`.

| Что | Где |
|-----|-----|
| HTTP `GET /api/products/`, `GET /api/products/{slug}/` | `entities/product/api` |
| React Query хуки | `useProducts` / `useProduct`, ключи `productKeys` |
| Мапперы API → UI-пропсы карточек | `toProductCardProps`, `toExpandedCardProps` |
| Фильтры, пагинация, `?product=` | `features/catalog` + `useCatalogParams` |

Конвенция ключей кэша:

```ts
productKeys.all            // ['products']
productKeys.list(params)   // ['products', 'list', params]
productKeys.detail(slug)   // ['products', 'detail', slug]
productKeys.pageOf(lookup) // ['products', 'page-of', { slug, category, ordering }]
```

Ключ списка собирает `productsQueryOptions(params)` — одна фабрика на всё приложение, поэтому витрина и deep-link-резолвер попадают в одну запись кэша.

Список кэшируется по полному объекту фильтров; при смене страницы используется `placeholderData: keepPreviousData`, чтобы грид не мигал скелетонами. Разворот карточки на витрине подгружает деталку отдельным запросом — списочный эндпоинт не отдаёт `attributes` и галерею.

В `ProductCard` поле `id` — UUID товара (для корзины/избранного). Expand и `?product=` работают по `slug` и передаются отдельно от `id`.

### Страница товара как deep-link

Отдельной вёрстки у `/product/:slug` нет: `pages/ProductPage` — резолвер, который открывает витрину на нужной странице с уже развёрнутой карточкой.

1. `useProduct(slug)` даёт категорию и название. 404 (`isNotFoundError` из `shared/api`) → «Не нашли такой товар» и кнопка в каталог; прочие ошибки → «Не удалось открыть товар» с повтором. Тем же `isNotFoundError` отключён retry на 404 в `AppProviders` — битая ссылка не должна ходить на бэк дважды.
2. `useProductPageNumber` через `findProductPage` (в `entities/product/model`) листает `GET /api/products/` страницами по `CATALOG_PAGE_SIZE` с дефолтной сортировкой и без фильтров, пока не встретит slug. Потолок — `min(MAX_SCANNED_PAGES, ceil(count / page_size))`: и от бесконечного `next`, и от лишних запросов сверх реального размера каталога.
3. `Navigate replace` на `CATEGORY_ROUTES[category]` с query из `buildCatalogSearchParams`: `page` — найденная страница, `product` — slug. Если товар не нашёлся в выдаче, редирект идёт без `?product=`.

Номер страницы вычисляется не «для красоты»: `CatalogPage` чистит `?product=`, если slug не лежит в выдаче текущей страницы, поэтому ссылка на товар со второй страницы без `page=2` открыла бы витрину без карточки. Скан использует `queryClient.fetchQuery` с тем же ключом списка, что и витрина, — последний запрос скана и есть тот, который нужен `CatalogPage`. `staleTime` в проекте не задан, поэтому витрина всё же дёрнет тот же ключ в фоне, но данные уже в кэше: грид рисуется сразу, без скелетона.

### Title вкладки

Название товара в заголовке вкладки ставит штатный `<title>` React 19 внутри `CatalogPage-Item` — React сам поднимает тег в `head` поверх статического из `index.html`, а при закрытии карточки убирает свой тег, и заголовок возвращается к `Coffee Shop`. `react-helmet-async` не подключаем: зависимость и провайдер ради одного тега не нужны, а поведение одинаково и для deep-link, и для обычного разворота карточки в гриде.

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
