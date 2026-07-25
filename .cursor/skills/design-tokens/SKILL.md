---
name: design-tokens
description: >-
  Design tokens Coffee Shop: цвета, spacing, radius, typography только из
  docs/design/design-tokens.md и frontend/src/shared/ui/tokens.css.
  Запрет hex и магических отступов в UI. Применять при любом стиле/теме/shared/ui.
---

# Design tokens

## Источник

- Документ: [docs/design/design-tokens.md](../../../docs/design/design-tokens.md)
- CSS: [`frontend/src/shared/ui/tokens.css`](../../../frontend/src/shared/ui/tokens.css) — единственное место новых значений во frontend

## Правила

- Цвета — `var(--color-*)`, не `#…` / `rgb(` в компонентах
- Отступы — `var(--space-*)`, не `padding: 13px`
- Радиусы / шрифты / тени — из шкалы tokens
- Новое значение: сначала в `design-tokens.md` и `tokens.css`, потом использование

## Связь

- БЭМ-структура — skill `bem-components`
- Ревью Design Guardian — `docs/agents/design-guardian.md`
