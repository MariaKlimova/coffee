# Design tokens (stub)

> Черновик до задачи разбора референсов / Epic 1 (COFFEE-10).  
> После фиксации токенов в коде этот файл синхронизировать с theme-модулем.

Использовать CSS-переменные (или будущий TS-модуль), **не** хардкодить hex/spacing в компонентах.

## Color

```css
:root {
  --color-bg: #f7f3ee;
  --color-surface: #ffffff;
  --color-text: #2c241b;
  --color-text-muted: #6b5e52;
  --color-accent: #8b4513;
  --color-accent-hover: #6f3610;
  --color-border: #e4dcd2;
  --color-danger: #b42318;
  --color-success: #3b6d11;
}
```

## Spacing

```css
:root {
  --space-2xs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
}
```

## Radius

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

## Typography

```css
:root {
  --font-sans: "Source Sans 3", system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.75rem;
}
```

Палитра ориентировочная (кофейня: тёплый фон, терракотовый акцент). Финальные значения — после референсов.
