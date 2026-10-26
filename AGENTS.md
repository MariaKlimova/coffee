# AGENTS — Coffee Shop

Общие инструкции для Codex и Cursor, роли и handoff между задачами.

## Роли

| Агент | Зона | Документ |
|-------|------|----------|
| **Backend Django** | `backend/**` | [docs/agents/backend-django.md](docs/agents/backend-django.md) |
| **Frontend React** | `frontend/src/**` | [docs/agents/frontend-react.md](docs/agents/frontend-react.md) |
| **Payments** | `backend/apps/payments/**` | [docs/agents/payments-integration.md](docs/agents/payments-integration.md) |
| **Design Guardian** | ревью UI vs tokens | [docs/agents/design-guardian.md](docs/agents/design-guardian.md) |
| **Copywriter** | тексты, glossary | [docs/agents/copywriter.md](docs/agents/copywriter.md) |
| **QA** | тесты | [docs/agents/qa-agent.md](docs/agents/qa-agent.md) |
| **Security Reviewer** | auth/secrets/XSS/CSRF | [docs/agents/security-reviewer.md](docs/agents/security-reviewer.md) |

## Handoff

- **UI / компоненты:** Frontend React + skills `bem-components`, `fsd-frontend`, `design-tokens`, `product-voice`
- **API / Django:** Backend Django + skill `django-api` + сверка с [docs/api/openapi.yaml](docs/api/openapi.yaml)
- **Платежи:** Payments + Security Reviewer
- **Запрет:** Frontend React **не** добавляет эндпоинты в `backend/` — handoff на Backend Django
- **Запрет:** Design Guardian / Security Reviewer / Copywriter **не** пишут фичи без явной просьбы (ревью / тексты / замечания)

## Стек

- `backend/` — Django + DRF + PostgreSQL
- `frontend/` — React + Vite + TypeScript, FSD
- Состояние: Zustand + TanStack Query
- Контракт API: `docs/api/openapi.yaml` → позже drf-spectacular

## Skills в Cursor и Codex

Единственный источник проектных skills — `.cursor/skills/<name>/SKILL.md`.
Codex обнаруживает те же файлы через относительные ссылки
`.agents/skills/<name> → ../../.cursor/skills/<name>`. Не создавать копии.
При добавлении skill сразу подключить его обоим инструментам и выполнить
`python3 scripts/check_agent_setup.py` (или `npm run check:agents`).

| Skill | Когда использовать |
|-------|--------------------|
| `bem-components`, `fsd-frontend` | UI-компоненты, страницы и границы FSD |
| `design-tokens`, `product-voice` | Стили и пользовательские тексты Coffee |
| `django-api` | Backend, контракт API, pytest |
| `coffee-jira` | Задачи COFFEE, требования, комментарии и связь с PR |
| `coffee-review` | Ревью diff/PR по существующему контракту BUGBOT |
| `coffee-qa` | Приёмка по AC и обязательный QA-комментарий в Jira |
| `coffee-task` | Взять выбранную задачу COFFEE целиком: реализация → проверки → review → QA |

Codex не применяет `.cursor/rules/*.mdc` автоматически. Перед изменениями читать
подходящие правила: `architecture.mdc` — слои; `typescript-standards.mdc` — TS/TSX;
`openapi-contract.mdc` — API; `design-tokens.mdc` — стили. Review читает все четыре.
Ссылки из skills должны работать через оба каталога; пути в backticks считать
относительными корню репозитория, если явно не указано иное.

## Subagents

| Subagent | Файл | Когда |
|----------|------|--------|
| **Code Review** | [`.cursor/agents/code-review.md`](.cursor/agents/code-review.md) | ревью PR/diff, `/code-review`, после крупной задачи |
| **QA Tester** | [`.cursor/agents/qa-tester.md`](.cursor/agents/qa-tester.md) | независимая приёмка после review, отчёт в Jira |

**Handoff Code Review → пользователь:** главный агент **не пересказывает** и **не сжимает** ответ Code Review. В чат уходит финальный markdown subagent’а целиком (включая «Сводка», «Все findings», категорийные таблицы, «Чистота кода»). Допустимо лишь короткое вступление («ревью готово») + ссылка на subagent.

Остальные роли живут через **docs/agents + skills + rules**; Code Review подхватывает их правила по зонам diff из `.cursor/BUGBOT.md`.

Файлы `.cursor/agents/*.md` описывают контракты ролей; они не регистрируют
Codex-агентов. Передавать их доступному механизму subagents. Для `coffee-task`
пользователь разрешил отдельного read-only code reviewer и отдельного QA Tester;
QA может писать предусмотренный отчёт и безопасные evidence в Jira. Повторно
разрешение на эти этапы не спрашивать. Исполнитель не принимает собственную
реализацию как независимый reviewer/QA. При недоступной делегации сообщить
ограничение, не объявлять этап независимой проверки выполненным.

## Выполнение задач и QA

- GitHub: https://github.com/MariaKlimova/coffee.
- Jira: https://klimovamaria5227.atlassian.net/jira/software/projects/COFFEE.
- Полный цикл — `.cursor/skills/coffee-task/SKILL.md`. Уточнения конкретной задачи
  читать и сохранять в её тикете, не в `AGENTS.md`. Указание тикета или файла
  само по себе не разрешает внешние действия вне запроса пользователя.
- Для кода использовать ветку `feat/COFFEE-N-short-name` или `fix/COFFEE-N-short-name`;
  для настройки без тикета — именованную ветку. Не писать напрямую в `main`.
- Review проверяет код и возвращает findings. QA отдельно проверяет актуальные AC,
  фиксирует ревизию, сценарии и evidence и публикует `PASS`, `FAIL` или `BLOCKED`
  в соответствующий тикет. Отсутствие браузера не превращает jsdom-тест в UI-приёмку.
- Вызов `coffee-qa` или QA-этапа `coffee-task` авторизует комментарий результата,
  в том числе `FAIL`/`BLOCKED`, без повторного согласования. Статус, assignee,
  описание и bug-тикеты QA не меняет. Не публиковать отчёт в произвольную задачу,
  если текущая работа не привязана к COFFEE-N.
- Merge, deploy, push и смену Jira-статуса выполнять только в пределах отдельного
  разрешения пользователя; повторно уже полученное разрешение не запрашивать.
- Для согласованного бэклога COFFEE пользователь разрешил координатору вести
  Jira-статусы без повторного согласования: при начале реализации — «В работе»,
  при передаче на приёмку — «На проверке», после подтверждённого merge в `main` —
  «Готово». Перед переходом читать текущий статус и доступные transitions,
  подтверждать результат по API. QA Tester по-прежнему только публикует отчёт;
  смена статуса остаётся ответственностью координатора.

### Координация выбранного бэклога

Пользователь разрешил последовательно выполнять созданный бэклог COFFEE и
распараллеливать независимые задачи. Главный агент координирует; для каждой
задачи назначает отдельного implementation-агента и Git worktree в
`worktrees/COFFEE-N-short-name/` основного checkout. Не смешивать реализации
в одном checkout. Следовать зависимостям Jira; переносить изменения общей базы
в task-ветки явно и повторять затронутые проверки.

Перед merge **каждую продуктовую задачу показать пользователю локально**:
поднять один preview, сообщить URL и что проверить, дождаться решения пользователя.
Review и QA можно выполнять до показа, но они не заменяют пользовательский просмотр.
Пока ожидается решение, продолжать независимую работу; не менять показанную ревизию
и не останавливать её preview без передачи/согласования просмотра. Следующую задачу
показывать после освобождения единственного dev-server. Уже разрешённое вливание
настроек агентов выполняется отдельно от этого этапа продуктовых задач.

## Локальные браузерные проверки

- Перед запуском проверить существующие браузеры, CDP-сессии, вкладки, серверы
  и память; переиспользовать подходящую сессию и одну выделенную вкладку задачи.
- Одновременно не более одного собственного Chrome/Chromium, одной управляющей
  сессии на endpoint, одной рабочей вкладки и одного собственного dev-сервера.
  Desktop/touch проверять последовательно в той же вкладке, меняя эмуляцию.
  Разные сервисы запускать последовательно. Дополнительные ресурсы допустимы
  только по явному запросу пользователя на такую параллельность.
- При недоступном CDP запускать один тестовый браузер только после подтверждения,
  что предыдущий собственный запуск завершён. Смена инструмента не создаёт второй
  браузер/профиль. Между агентами передавать исключительное владение браузером
  и сервером только после cleanup предыдущего исполнителя.
- Записывать исходные пользовательские вкладки/серверы и PID, session ID, профиль
  созданных ресурсов; проверять память до тяжёлого прогона и после запуска.
  При дефиците сначала освободить собственные ресурсы, не запускать поверх них.
- При завершении, ошибке или смене инструмента закрыть созданные вкладки,
  отсоединить CDP от пользовательского браузера и остановить только подтверждённые
  собственные browser/server процессы. В scripts использовать `finally`.
  Пользовательский браузер не закрывать; массовый kill Chrome/Chromium запрещён.

## Источники истины

- Архитектура: [docs/architecture.md](docs/architecture.md)
- API: [docs/api/openapi.yaml](docs/api/openapi.yaml)
- Design tokens: [docs/design/design-tokens.md](docs/design/design-tokens.md) → `frontend/src/shared/ui/tokens.css`
- Glossary / тон: [docs/content/glossary.md](docs/content/glossary.md)
- UI copy (код): `frontend/src/shared/lib/copy/`
