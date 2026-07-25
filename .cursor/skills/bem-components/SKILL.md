---
name: bem-components
description: >-
  БЭМ-структура UI в frontend: папка на каждый компонент (typings, styles,
  const, tsx, index), блок PascalCase, элементы BlockName-ElementName / -ElementName.
  Применять при любом новом UI, модалке, карточке, выносе разметки из страницы.
  Пути: frontend/src/shared/ui, frontend/src/features/{feature}/ui.
---

# БЭМ-компоненты — Coffee Shop Frontend

## Где лежат компоненты

- **`frontend/src/shared/ui/`** — переиспользуемые блоки дизайн-системы
- **`frontend/src/features/{feature}/ui/`** — блоки фичи

Страницы в `pages/` — композиция блоков, не свалка разметки.

**Запрещено:** одиночный `.tsx` без папки (`ProductCard.tsx` рядом с другими файлами). Каждый компонент — **своя папка**.

---

## Папка компонента

Каждый **блок** и каждый **элемент** — отдельная папка. Минимум: `.tsx` + `index.ts` (и стили, если есть).

| Файл | Когда нужен |
|------|-------------|
| `BlockName.tsx` | Всегда — разметка и логика. Без сырых user-visible строк и без хардкод hex. |
| `BlockName.typings.ts` | Есть пропсы / локальные типы (поля interface с JSDoc) |
| `BlockName.module.css` | Стили блока (БЭМ-классы или CSS Modules) |
| `BlockName.const.ts` | test ids, пороги, длительности |
| `index.ts` | Всегда — публичный реэкспорт |

Не создавай пустые файлы «для галочки».

Снаружи папки импортируют **только** из `index.ts`:

```ts
import { ProductCard } from '@shared/ui/ProductCard'
```

---

## Блок и элемент

- **Блок:** папка `BlockName/`, компонент `BlockName`
- **Элемент:** `BlockName-ElementName/` или `-ElementName/` внутри блока; снаружи блока элементы не импортируются

Модификаторы — через пропсы (`variant`, `size`, `disabled`) и tokens (skill `design-tokens`).

## Чеклист

1. Своя папка под блок/элемент
2. Публичный API только через `index.ts`
3. Стили через tokens, тексты через copy/glossary (не литералы в JSX без причины)
4. Нет импорта «вверх» по FSD
