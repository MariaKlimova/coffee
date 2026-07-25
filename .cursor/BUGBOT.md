# Bugbot — coffee

Локальный контракт findings для subagent [Code Review](agents/code-review.md).

Проект: интернет-магазин кофе и кофемашин. Backend — Django/DRF, frontend — React/Vite (FSD).

## Общие принципы

- Ревью на русском, тон спокойный и конкретный.
- Различай **blocking** и **recommendation**.
- Не предлагай рефакторинг вне scope PR без явной пользы.
- Не дублируй каждый ESLint warning — кроме cross-file мёртвого кода и SRP.

---

## Архитектура

Слои frontend: `app` → `pages` → `features` → `entities` → `shared`.

If diff нарушает FSD (импорт «вверх», API-логика в `pages` без feature, UI в `shared/api`):

- **blocking**: «Нарушение FSD — перенеси в правильный слой».

If frontend меняет `backend/` URL/views «чтобы починить UI»:

- **blocking**: «API меняет Backend Django; frontend только клиент».

If Django-код хардкодит секреты:

- **blocking**: «Секреты только из env».

---

## TypeScript

If публичный `interface` без JSDoc на поле:

- **blocking**: «У каждого поля публичного interface нужен JSDoc».

If nested ternary:

- **blocking**: «Вложенные тернарные операторы запрещены».

---

## БЭМ

When reviewing `frontend/src/shared/ui/**`, `frontend/src/features/**/ui/**`:

- Компонент = папка + `index.ts`; нет одиночных `.tsx` без папки
- Снаружи только импорт из `index.ts`

If новый UI-блок добавлен одним файлом без папки:

- **blocking**: «БЭМ: вынеси компонент в собственную папку (skill bem-components)».

---

## Product voice и copy

When reviewing UI / pages / features:

- User-visible строки не должны быть разбросаны техжаргоном API
- Повторяющиеся формулировки — согласовать с `docs/content/glossary.md`

If захардкожена user-visible строка с API-жаргоном или дубль уже существующей фразы без glossary:

- **blocking** или **recommendation** (по серьёзности): «Вынеси/согласуй copy (product-voice, glossary)».

Допустимы: stub-страницы с коротким названием экрана на этапе скелета; отмечай recommendation, не блокируй скелет без нужды.

---

## Design tokens

Источник: `docs/design/design-tokens.md` (stub → theme-модуль).

If в UI появляются hex/rgb или «магические» px вне tokens:

- **blocking**: «Используй design tokens (CSS variables из docs/design/design-tokens.md)».

---

## OpenAPI

If меняются пути/методы/схемы API без сверки с `docs/api/openapi.yaml`:

- **blocking**: «Сверься с OpenAPI-контрактом и обнови YAML или код».

---

## Secrets / Payments

If в diff логируются токены, `.env` с секретами, сырой webhook PII:

- **blocking** security finding.

---

## Дублирование кода

Ищи по репозиторию (не только hunk):

1. Одинаковая логика ≥8 строк
2. Одинаковые типы/константы в двух местах
3. Одинаковая UI-разметка без shared блока
4. Дубли copy

**blocking** — логика ≥8 строк или два источника правды в одном PR.  
**recommendation** — мелкие helpers/стили/copy.

---

## Мёртвый код

- Новый export без usages вне файла/тестов → **blocking**
- Orphan-файл без импортов → **blocking**
- Закомментированные блоки ≥3 строк → recommendation
- Orphan keys в copy/const после рефактора → recommendation

Entry points (`main.tsx`, routes) не считать orphan.

---

## Чистота кода

Отдельный обязательный проход (аналог §3.5 cozy).

**Кандидаты:** новый модуль (не тест/styles); ≥20 LOC net в hook/lib/view/serializer; файл ≥250 строк; оркестрация.

Проверяй:

1. **SRP** — нет God-module / utils-свалки
2. **Имя = поведение** — нет лживых имён про side-effects
3. **Проза** — длинные цепочки с фасадом
4. **Coupling** — ключи/ID не размазаны
5. **Boy scout** — мёртвый шум рядом с hunk

If PR *добавляет* ответственность в God-модуль без выноса:

- **blocking**: «Ухудшение SRP — вынеси новую зону».

Code Review **обязан** заполнить таблицу «Чистота кода» (одна строка на кандидата), даже при нуле findings.

---

## Зоны ревью по diff

| Путь | Фокус |
|------|--------|
| `frontend/src/shared/ui/**`, `features/**/ui/**` | БЭМ, tokens, product-voice |
| `frontend/src/pages/**`, `app/**` | FSD, composition |
| `frontend/src/shared/api/**` | OpenAPI client |
| `backend/**` | django-api, OpenAPI, secrets |
| `docs/api/**` | контракт |
| `docs/design/**`, `docs/content/**` | tokens, glossary |

---

## CI

`backend-ci` (ruff, black, pytest), `frontend-ci` (lint, typecheck, test, build), `commitlint`.  
Не повторяй чистый стиль ESLint/ruff, кроме мёртвого кода cross-file и SRP.
