# Contributing

## Ветка `main`

В `main` нельзя пушить напрямую — только через pull request. CI (lint / typecheck / tests / commitlint) должен быть зелёным перед merge.

## Conventional Commits

Формат сообщения:

```
type(scope): краткое описание
```

`scope` опционален. Описание — в императиве, с маленькой буквы, без точки в конце.

### Типы

| Тип | Когда |
|-----|--------|
| `feat` | новая функциональность |
| `fix` | исправление бага |
| `docs` | только документация |
| `chore` | рутина (зависимости, конфиги, структура репо) |
| `refactor` | рефакторинг без смены поведения |
| `test` | тесты |
| `ci` | CI/CD |

### Примеры

```
feat(cart): add quantity stepper
fix(api): return 404 for missing product
docs: describe local setup in README
chore: init monorepo structure
refactor(backend): split settings by environment
test(frontend): cover ProductCard render
ci: run lint on pull requests
```

При `git commit` husky запускает commitlint и отклоняет сообщения вне этой конвенции.

После клонирования репозитория один раз выполните `npm install` в корне — скрипт `prepare` установит git-хуки.
