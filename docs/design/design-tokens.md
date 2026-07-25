# Design tokens

Источник истины для визуальной системы Coffee Shop (Epic 1 / COFFEE-10).

| Слой | Файл |
|------|------|
| Документ (имена, значения, роли, примеры) | этот файл |
| Канон CSS (`:root`) | [`frontend/src/shared/ui/tokens.css`](../../frontend/src/shared/ui/tokens.css) |

Значения в таблицах ниже должны совпадать с `tokens.css`. Полные `:root`-дампы в markdown не дублируем — правки палитры/шкалы вносятся в `tokens.css`, затем синхронизируются таблицы здесь.

В компонентах использовать только CSS-переменные (`var(--…)`), не хардкодить hex и «магические» отступы.

Референс-картинки в репозиторий не кладём: значения зафиксированы по согласованной с заказчиком «Утверждённой базе» (мокапы главной и карточки товара).

---

## Шрифты

| Роль | Семейство | Источник |
|------|-----------|----------|
| Заголовки (h1–h3, бренд) | **Lora**, fallback `Georgia, serif` → `--font-display` | [Google Fonts](https://fonts.google.com/specimen/Lora) — подключение в `frontend/index.html` |
| UI / тело | Системный sans → `--font-sans` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` |

---

## Color

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--color-bg` | `#F7F2EA` | Фон страницы |
| `--color-surface` | `#FFFDF9` | Карточки, поля, панели |
| `--color-border` | `#E3D9C8` | Рамки, разделители |
| `--color-primary` | `#B0592A` | Акцент: кнопки, цены, активные состояния |
| `--color-primary-hover` | `#964A24` | Hover/active primary |
| `--color-primary-on` | `#FFF5EC` | Текст/иконки на primary |
| `--color-secondary` | `#6B7A4F` | Второй акцент (категория «Кофе в зёрнах» и т.п.) |
| `--color-neutral` | `#3E362C` | Тёмный нейтральный акцент (плитка «Кофемашины») |
| `--color-text` | `#2E2A22` | Основной текст |
| `--color-text-secondary` | `#5C5346` | Вторичный текст |
| `--color-text-muted` | `#8C8272` | Вспомогательный текст |
| `--color-text-placeholder` | `#A69C8B` | Плейсхолдеры |
| `--color-danger` | `#B42318` | Ошибки форм |
| `--color-success` | `#3B6D11` | Успех / положительный статус |
| `--color-badge-bg` | `#EDE6DA` | Фон мягкого бейджа («Нет в наличии») |
| `--color-badge-text` | `#5C5346` | Текст бейджа |

---

## Typography

| Токен | Значение | Роль |
|-------|----------|------|
| `--text-caption` | `0.75rem` (12px) | Вспомогательный текст, мета |
| `--text-sm` | `0.875rem` (14px) | Заголовки карточек, мелкий UI |
| `--text-md` | `1rem` (16px) | Основной текст |
| `--text-lg` | `1.25rem` (20px) | Подзаголовки |
| `--text-xl` | `2rem` (32px) | h1 / крупные бренд-моменты |
| `--leading-tight` | `1.25` | Заголовки |
| `--leading-normal` | `1.5` | Тело |
| `--weight-regular` | `400` | Обычный |
| `--weight-medium` | `500` | Акцент UI |
| `--weight-semibold` | `600` | Заголовки Lora |

---

## Spacing

| Токен | Значение |
|-------|----------|
| `--space-2xs` | `4px` |
| `--space-xs` | `8px` |
| `--space-sm` | `12px` |
| `--space-md` | `16px` |
| `--space-lg` | `24px` |
| `--space-xl` | `32px` |
| `--space-2xl` | `48px` |

---

## Radius

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--radius-sm` | `6px` | Кнопки, поля, чипы |
| `--radius-md` | `8px` | Крупнее контролы |
| `--radius-lg` | `12px` | Карточки |
| `--radius-xl` | `16px` | Крупные блоки / плитки категорий |

---

## Shadow

Мягкие приглушённые тени (карточки, sticky header).

| Токен | Значение |
|-------|----------|
| `--shadow-sm` | `0 1px 2px rgba(46, 42, 34, 0.06)` |
| `--shadow-md` | `0 4px 12px rgba(46, 42, 34, 0.08)` |

---

## Grid (desktop-first)

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--layout-max-width` | `1120px` | Контентная колонка |
| `--layout-gutter` | `var(--space-lg)` | Боковые отступы |
| `--layout-columns-gap` | `var(--space-md)` | Зазор в сетке карточек |

---

## UI-гайдлайны (не отдельные токены)

- **Бейджи** — мягкий фон + тёмный текст того же оттенка (`--color-badge-*`), без яркой заливки.
- **Header** — лёгкий, sticky; фон surface/bg, мягкая тень `--shadow-sm`.
- **Иконки** — outline (избранное — сердце, корзина — сумка, поиск — лупа). Реализация в COFFEE-11+.

---

## Примеры применения

Примеры ниже — ориентир для компонентов (COFFEE-11 / COFFEE-12). В UI не копировать hex; только `var(--…)`.

### 1. Кнопка primary

```css
.Button--primary {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  line-height: var(--leading-tight);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-primary);
  color: var(--color-primary-on);
}

.Button--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.Button--primary:disabled {
  opacity: 0.5;
}
```

### 2. Карточка товара

```css
.ProductCard {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-md);
}

.ProductCard-Title {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  line-height: var(--leading-tight);
}

.ProductCard-Price {
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-primary);
}

.ProductCard:hover {
  box-shadow: var(--shadow-md);
}
```

### 3. Бейдж «Нет в наличии»

```css
.Badge--outOfStock {
  display: inline-block;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: var(--weight-medium);
  line-height: var(--leading-tight);
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-sm);
  background: var(--color-badge-bg);
  color: var(--color-badge-text);
}
```
