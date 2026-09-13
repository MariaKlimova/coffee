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

If в **новом или изменённом** коде комментарии / JSDoc на английском (кроме устоявшихся имён API/OpenAPI полей вроде `cart_token`):

- **recommendation** (при массовом английском в hunk — **blocking**): «Комментарии и JSDoc пиши на русском».

---

## БЭМ

When reviewing `frontend/src/shared/ui/**`, `frontend/src/features/**/ui/**`:

- Компонент = папка + `index.ts`; нет одиночных `.tsx` без папки
- Снаружи только импорт из `index.ts`
- User-visible тексты — из `@shared/lib/copy`, не литералы в JSX

If новый UI-блок добавлен одним файлом без папки:

- **blocking**: «БЭМ: вынеси компонент в собственную папку (skill bem-components)».

---

## Product voice и copy

When reviewing UI / pages / features / `shared/ui`:

- User-visible строки — только из `frontend/src/shared/lib/copy/` (`AUTH_COPY`, `CART_COPY`, …)
- Формулировки согласовать с `docs/content/glossary.md`
- Не плодить локальные `*_COPY` / литералы в JSX, дублирующие shared copy

If новая или изменённая user-visible строка захардкожена вне `shared/lib/copy` (не stub-скелет):

- **blocking**: «UI-copy только из `@shared/lib/copy` (product-voice, glossary)».

If API-жаргон в UI или формулировка расходится с glossary:

- **blocking** или **recommendation** (по серьёзности): «Согласуй copy с glossary и `shared/lib/copy`».

Допустимы: stub-страницы с коротким названием экрана на этапе скелета; отмечай recommendation, не блокируй скелет без нужды.

---

## Design tokens

Источник: `docs/design/design-tokens.md` и `frontend/src/shared/ui/tokens.css`.

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
| `frontend/src/shared/ui/**`, `features/**/ui/**` | БЭМ, tokens, product-voice, copy из `shared/lib/copy` |
| `frontend/src/pages/**`, `app/**` | FSD, composition, copy |
| `frontend/src/shared/lib/copy/**` | единый UI-copy, glossary |
| `frontend/src/shared/api/**` | OpenAPI client |
| `backend/**` | django-api, OpenAPI, secrets |
| `docs/api/**` | контракт |
| `docs/design/**`, `docs/content/**` | tokens, glossary |

---

## CI

`backend-ci` (ruff, black, pytest), `frontend-ci` (lint, typecheck, test, build), `commitlint`.  
Не повторяй чистый стиль ESLint/ruff, кроме мёртвого кода cross-file и SRP.
