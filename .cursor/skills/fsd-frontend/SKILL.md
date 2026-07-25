---
name: fsd-frontend
description: >-
  Feature-Sliced Design в frontend/src: app, pages, features, entities, shared;
  алиасы @app @pages @entities @features @shared; границы импортов.
  Применять при новых страницах, фичах, рефакторинге слоёв.
---

# FSD Frontend

## Слои (сверху вниз)

1. `app` — providers, router
2. `pages` — композиция экранов
3. `features` — действия пользователя
4. `entities` — модели предметной области
5. `shared` — ui, api, lib, store

Импорт только из своего слоя и ниже. Нельзя: `shared` → `features`.

## Алиасы

`@app`, `@pages`, `@entities`, `@features`, `@shared` — см. `vite.config.ts` / `tsconfig.app.json`.

## UI

Переиспользуемые блоки — `@shared/ui` по skill `bem-components`.  
HTTP — `@shared/api` с `VITE_API_BASE_URL`.
