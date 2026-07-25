---
name: design-tokens
description: >-
  Design tokens Coffee Shop: цвета, spacing, radius, typography только из
  docs/design/design-tokens.md (позже — theme-модуль). Запрет hex и магических
  отступов в UI. Применять при любом стиле/теме/shared/ui.
---

# Design tokens

## Источник

Сейчас (stub до COFFEE-10 / Epic 1): [docs/design/design-tokens.md](../../../docs/design/design-tokens.md).

Позже: CSS variables / TS-модуль в `frontend/src/shared` (единственное место новых значений).

## Правила

- Цвета — `var(--color-*)`, не `#…` / `rgb(` в компонентах
- Отступы — `var(--space-*)`, не `padding: 13px`
- Радиусы / шрифты — из шкалы tokens
- Новое значение: сначала в tokens-документ (и theme), потом использование

## Связь

- БЭМ-структура — skill `bem-components`
- Ревью Design Guardian — `docs/agents/design-guardian.md`
