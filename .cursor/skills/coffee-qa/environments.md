# Окружения и проверки Coffee

Источники запуска — корневой `README.md`, `frontend/package.json`,
`backend/pyproject.toml`, `backend/pytest.ini`, `.github/workflows/` и текущий runtime.
Команды ниже — из корня репозитория; не предполагать, что зависимости/БД уже готовы.

| Зона | Проверки |
|------|----------|
| React/TS | `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend test`, `npm --prefix frontend run build`; адресный test можно передать через `--` |
| Django/API | Из `backend/` в подготовленном venv: `ruff check .`, `black --check .`, `pytest` или относящаяся выборка; нужна изолированная PostgreSQL test DB с разрешением создавать тестовую БД |
| API-контракт | Сверка `docs/api/openapi.yaml` и drf-spectacular с затронутыми методами/полями, API-сценарий на тестовых данных |
| Agent skills/rules | `python3 scripts/check_agent_setup.py` и `python3 -m unittest discover -s scripts/tests -p 'test_*.py'`; сборки приложения только ради Markdown не требуются |

Полный набор обязателен для затронутой зоны перед handoff продуктовых изменений;
адресные тесты дополняют его. Нерелевантную зону пропустить с причиной. Чистая
сборка и unit-тесты не заменяют обязательные пользовательские AC.

## Что доказывает среда

| Среда | Граница доказательства |
|-------|------------------------|
| Frontend с synthetic/mock API | Проверяет UI/состояния на тестовых данных, не Django, реальное сохранение или оплату |
| Local frontend + существующий изолированный test API | Полный сценарий только если известны revision, данные и доступ обоих компонентов; не считать production API тестовым по домену |
| Local Django + PostgreSQL | pytest/HTTP проверяют backend и тестовую БД; браузерный frontend этим не проверен |
| Deployed preview/staging | Назвать URL без секретов, revision и тестовый доступ. Если revision/провайдер/storage неизвестен, записать ограничение |

Для локального UI использовать один frontend dev-server и разрешённый существующий
test API либо явно обозначенные моки. Для backend-сценария остановить собственный
frontend-сервер перед запуском backend. Вспомогательная изолированная БД не является
вторым web dev-server. Корневой `npm run dev` запускает оба web-сервиса Compose
и для QA при действующем лимите одного собственного dev-server не подходит.

Не копировать `.env`/credentials из `praktika`, других checkout или production,
не отключать JWT/staff/CSRF ради теста. Использовать штатный вход и synthetic
покупателя/staff только в разрешённой изолированной среде. Нельзя считать staff
доступ доказанным по одному скрытому пункту меню: проверять отрицательные API-запросы.

## Сценарии по изменению

- Каталог/карточка: кофе и кофемашина, фильтры/сортировка/поиск, пустой/error ответ,
  длинные данные, раскрытие/deep link/Back, избранное и корзина.
- Админка: guest/user/staff, create/edit/hide, валидация атрибутов и цен,
  загрузка/главное фото/порядок, ошибки API и сохранение после reload.
- Корзина/заказ: гость и пользователь, количество/удаление/нет в наличии, актуальный
  итог, ошибки формы, повторный submit и восстановление pending-заказа.
- Платежи: только YooKassa demo/test shop и test DB. Указать mock/demo отдельно;
  webhook/idempotency/доступ проверять backend-тестами и доступной демо-интеграцией.
  Production payment URL не открывать для оплаты. Мок не доказывает реальную ЮKassa.
- Мобильный scope: 320/360/390/430 px и desktop 1280 px, keyboard/focus,
  длинные значения, экранная клавиатура/zoom по задаче. Реальные iOS Safari/Android
  Chrome и эмуляцию различать; браузеры не запускать параллельно.
