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
| Заголовки (h1–h3, бренд) | **Lora**, fallback `Georgia, serif` → `--font-display` | [Google Fonts](https://fonts.google.com/specimen/Lora) — `frontend/index.html` |
| UI / тело | **Inter**, fallback system → `--font-sans` | [Google Fonts](https://fonts.google.com/specimen/Inter) — веса 400/500/600 |

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
| `--color-badge-bg` | `#EDE6DA` | Фон мягкого бейджа («Нет в наличии»), фон круглой кнопки «Закрыть» |
| `--color-badge-text` | `#5C5346` | Текст бейджа |
| `--color-border-hover` | `#D8C9B0` | Рамка карточки в hover |
| `--color-media-placeholder` | `#EFE6D8` | Фон медиа до загрузки фото |
| `--color-skeleton-base` | `var(--color-badge-bg)` | База шиммера скелетона |
| `--color-skeleton-highlight` | `var(--color-surface)` | Блик шиммера скелетона |
| `--color-overlay-control` | mix text 45% + transparent | Подложка стрелок карусели поверх фото |
| `--color-dot` | mix text 18% + transparent | Неактивная точка карусели |

---

## Typography

Базовая шкала — Inter (`--font-sans`); `--text-display-*` — заголовки на Lora (`--font-display`).

| Токен | Значение | Роль |
|-------|----------|------|
| `--text-2xs` | `0.6875rem` (11px) | Overline категории, значения шкал, мелкие бейджи |
| `--text-caption` | `0.75rem` (12px) | Вспомогательный текст, мета, описание карточки |
| `--text-sm` | `0.875rem` (14px) | Мелкий UI, описание в расширенной карточке |
| `--text-md` | `1rem` (16px) | Основной текст, цена в карточке |
| `--text-lg` | `1.25rem` (20px) | Подзаголовки, цена в расширенной карточке |
| `--text-xl` | `2rem` (32px) | h1 / крупные бренд-моменты |
| `--text-display-xs` | `1.0625rem` (17px) | Заголовок карточки товара (Lora) |
| `--text-display-sm` | `1.625rem` (26px) | Заголовок расширенной карточки (Lora) |
| `--letter-spacing-overline` | `0.06em` | Разрядка uppercase-overline |
| `--leading-tight` | `1.25` | Заголовки |
| `--leading-snug` | `1.4` | Короткие описания в карточках |
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
| `--radius-pill` | `999px` | Бейджи-пилюли, точки карусели, сегменты шкал |
| `--radius-circle` | `50%` | Круглые иконочные кнопки |

---

## Shadow

Мягкие приглушённые тени (карточки, sticky header).

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--shadow-sm` | `0 1px 2px rgba(46, 42, 34, 0.06)` | Карточка в покое, header |
| `--shadow-md` | `0 4px 12px rgba(46, 42, 34, 0.08)` | Hover карточки, тост |
| `--shadow-lg` | `0 8px 28px rgba(46, 42, 34, 0.1)` | Расширенная карточка товара |

---

## Grid (desktop-first)

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--layout-max-width` | `1120px` | Контентная колонка |
| `--layout-gutter` | `var(--space-lg)` | Боковые отступы |
| `--layout-columns-gap` | `var(--space-md)` | Зазор в сетке карточек |
| `--grid-card-min` | `16rem` | Минимальная колонка сетки карточек |
| `--expanded-pane-basis` | `380px` | Базовая ширина колонки в расширенной карточке |

---

## Controls

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--control-height-sm` | `32px` | Высота кнопки sm |
| `--control-height-md` | `40px` | Высота кнопки md / Input / Select |
| `--control-height-lg` | `48px` | Высота кнопки lg |
| `--size-control-icon` | `1.125rem` | Иконка в поле / choice-box |
| `--size-icon-sm` | `14px` | Иконка в малой круглой кнопке (сердце, стрелка карусели) |
| `--size-icon-md` | `16px` | Иконка «Закрыть», иконка характеристики |
| `--size-icon-button-sm` | `22px` | Круглая кнопка на фото (стрелки карусели) |
| `--size-icon-button-md` | `28px` | Круглая кнопка «В избранное» / «Закрыть» |
| `--focus-ring` | `0 0 0 2px` + mix primary 25% | Focus ring по умолчанию |
| `--focus-ring-danger` | `0 0 0 2px` + mix danger 25% | Focus ring в состоянии error |
| `--color-badge-success-bg` | mix success 16% + surface | Фон Badge success |
| `--color-badge-danger-bg` | mix danger 14% + surface | Фон Badge danger |

---

## Media & cards

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--aspect-media-card` | `4 / 3` | Пропорции фото товара |
| `--size-dot` | `5px` | Точка карусели |
| `--size-dot-active` | `12px` | Ширина активной точки |
| `--size-scale-label` | `5rem` | Колонка подписи шкалы вкуса |
| `--size-scale-segment` | `5px` | Высота сегмента шкалы вкуса |
| `--size-skeleton-line` | `12px` | Высота строки скелетона |
| `--size-skeleton-line-lg` | `16px` | Высота строки-заголовка скелетона |
| `--size-empty-max` | `28rem` | Максимальная ширина пустого состояния |
| `--size-toast-max` | `22rem` | Максимальная ширина тоста |
| `--filter-muted` | `grayscale(60%)` | Приглушение фото «Нет в наличии» |

---

## Layers (z-index)

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--layer-card-surface` | `1` | Растянутая зона клика по карточке |
| `--layer-media-control` | `2` | Стрелки и точки поверх фото |
| `--layer-card-overlay` | `3` | Бейдж, «В избранное», кнопка корзины |
| `--layer-toast` | `1000` | Стек тостов |

---

## Motion

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--duration-fast` | `150ms` | Hover/focus контролов |
| `--duration-normal` | `220ms` | Появление расширенной карточки |
| `--duration-shimmer` | `1.4s` | Цикл шиммера скелетона |
| `--ease-standard` | `ease` | Базовая кривая |
| `--ease-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` | Раскрытие карточки |
| `--lift-hover` | `-2px` | Подъём карточки в hover |
| `--scale-enter-from` | `0.97` | Стартовый масштаб появления |

Анимации отключаются при `prefers-reduced-motion: reduce`.

---

## UI-гайдлайны (не отдельные токены)

- **Бейджи** — `neutral` через `--color-badge-*`; `success` / `danger` через `--color-badge-success-bg` / `--color-badge-danger-bg` + цвет текста semantic.
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

Отдельного блока нет: используем `Badge` варианта `neutral`, а карточка задаёт только позицию.

```css
.ProductCard-Badge {
  position: absolute;
  top: var(--space-xs);
  left: var(--space-xs);
  z-index: var(--layer-card-overlay);
  border-radius: var(--radius-pill);
}
```
