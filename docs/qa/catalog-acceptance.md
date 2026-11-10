# Приёмка управления каталогом — COFFEE-46

Чеклист актуальных AC COFFEE-46, включая остатки COFFEE-62 и переход с demo.
Это сценарий для независимого QA, а не запись выполненного smoke. Результат,
точную ревизию, окружение и evidence QA публикует в
[COFFEE-46](https://klimovamaria5227.atlassian.net/browse/COFFEE-46).

## Стенд и доказательства

- Зафиксировать backend/frontend SHA, URL, время, test run ID, версии браузера
  и PostgreSQL, режим оплаты и storage. Использовать synthetic staff и покупателя,
  штатные JWT и отдельную PostgreSQL БД с данными только текущего прогона.
- До записи проверить владельца стенда и изоляцию. Общий Neon main не использовать
  для переключения каталога, заказов, webhook и seed. Для этих сценариев нужен
  согласованный изолированный staging либо локальный PostgreSQL + Django + SPA.
  Локальный результат записывать как local; staging AC остаётся отдельным пунктом.
- Один web dev-server: собранную SPA можно обслуживать тем же локальным Django
  через runtime harness. Harness, БД, media и provider fake живут вне продуктового
  кода; настройки не копируют secrets/.env других checkout. Fake подменяет только
  provider adapter; JWT, staff-права, обработка webhook и inventory остаются настоящими.
- Оплата — только тестовая ЮKassa либо явно обозначенный mock. Mock должен хранить
  согласованные ID/amount/RUB/test/status и возвращать их при серверной перепроверке
  платежа. Поддельный POST webhook без проверяемого provider GET не доказывает оплату.
- До/после тяжёлых проверок проверить память; записать исходные пользовательские
  ресурсы и PID/профиль своих. Один браузер, CDP-контроллер, вкладка и web-сервер;
  desktop и touch последовательно. При завершении cleanup через `finally`,
  отсоединение от пользовательского браузера без его закрытия.
- Сохранять безопасные скриншоты, HTTP status/code, ID synthetic товаров/заказов,
  выбранные поля до/после, результаты seed/restart и логи PostgreSQL тестов.
  JWT, пароли, provider credentials и реальные контакты в evidence не включать.

Ранее выполненные реальные storage-проверки COFFEE-43/47 (QA-комментарии
[10807](https://klimovamaria5227.atlassian.net/browse/COFFEE-43?focusedCommentId=10807)
и [10809](https://klimovamaria5227.atlassian.net/browse/COFFEE-47?focusedCommentId=10809))
относятся к своим ревизиям. Они не являются новым staging smoke COFFEE-46.
Локальные filesystem/SDK fake проверки также не заменяют AC постоянного cloud
storage: отдельный staging прогон должен показать доступность фото после
перезапуска/redeploy изолированного backend при том же storage.

## Права и публикация

| Роль | Прямые manage-запросы | Ожидание |
|---|---|---|
| Anonymous | list/detail, POST/PATCH/DELETE товара, upload/PATCH/DELETE существующего фото, GET catalog/POST disable-demo | 401, данные и файл не меняются |
| Покупатель | Те же запросы со своим действительным JWT | 403, данные и файл не меняются |
| Active staff | Те же операции с корректными данными | 200/201/204; бизнес-валидация сохраняется |

- [ ] Без входа прямой `/manage/products` предлагает штатный вход; покупатель
  не получает форму управления. Проверить отрицательные HTTP-запросы, а не только меню.
- [ ] В настоящем браузере владелец создаёт кофе с уникальным run ID, ценой,
  количеством **3** и выключенной публикацией. Сохранить UUID, slug и поля.
  Загрузить свою JPEG/PNG/WebP, добавить вторую, поменять порядок и главное фото.
  Reload показывает сохранённые поля и галерею. Отдельно повторить для кофемашины.
- [ ] До публикации товара нет в public list, detail даёт 404, related его не
  содержит; manage detail доступен staff. После публикации открыть `/coffee` или
  `/machines`, раскрыть товар и deep link: цена, доступно 3 и главное фото совпадают.
- [ ] Снять публикацию в SPA: товар исчезает из list/related, detail даёт 404,
  manage сохраняет UUID, stock и галерею (`hidden_reason=unpublished`). Проверить
  reload витрины. Повторное снятие публикации безопасно; опубликованный сосед виден.
- [ ] Валидация категории, цены, количества и формата/размера файла работает;
  отказ API не показывает успешное сохранение. Повторить корректную операцию после
  ошибки. Фото загружаются только после создания товара; ошибки storage сохраняют
  галерею и позволяют осознанный retry. Не перезаписывать неизвестный исход upload.

## Остатки, резерв и сохранность

Использовать отдельный опубликованный owner-товар со складом 3, резервом 0.
Значения сверять через staff/public API после действий браузера.

- [ ] Покупатель кладёт 2 и оформляет заказ: склад **3**, резерв **2**, доступно
  **1**. Корзина сама по себе резерв не создаёт. Второму покупателю нельзя купить 2:
  API `400/insufficient_stock`, заказ/резерв не создаются; интерфейс сообщает
  актуальное наличие. Проверить прямой checkout с устаревшей корзиной.
- [ ] Подтверждённая тестовая/mock оплата списывает ровно 2: склад **1**, резерв
  **0**, доступно **1**. Повторить webhook: те же счётчики и один платёжный результат.
  Сохранить payment/order ID и ответ provider fake без secrets.
- [ ] Для отдельного owner-товара со складом 0 карточка сообщает отсутствие,
  добавить/оформить нельзя; прямой API также отклоняет операцию.
- [ ] Для двух отдельных неоплаченных заказов выполнить соответственно отмену
  и истечение. Активный резерв возвращается один раз, склад не меняется.
  Повторить отмену/cleanup и сверить значения. Expiry подтвердить серверным временем
  и настоящим ingress/`expire_stock_reservations`, не только таймером интерфейса.
- [ ] Владелец меняет физическое количество, указывает причину; reload сохраняет
  его. Попытка установить меньше активного резерва отклоняет весь PATCH, остальные
  поля не меняются. Проверить `StockAdjustment` (actor/before/after/reason).
- [ ] Сохранить snapshot товара/галереи/резервов. Обычный `seed_catalog` запустить
  дважды и перезапустить тот же backend с той же БД/media; на staging — redeploy
  той же ревизии. Поля владельца и значения склада/резерва не сброшены. Браузерный
  reload сам по себе не считается restart/redeploy. Остатки не править SQL вручную.

## Переход с demo на рабочий каталог

- [ ] В отдельной чистой БД создать demo штатным seed. Снять snapshot **явных**
  `origin`, `demo_source`, UUID и `images[].is_mock`; происхождение не определять
  по похожему названию/slug. При пустом опубликованном owner-каталоге открыть
  подтверждение: предупреждение о пустой будущей витрине видно. Отмена ничего не меняет.
- [ ] Создать свои товары с ценой, stock и реальной галереей; переработать одну
  demo-позицию с явным согласием `save_as_owner`. У второй сохранить owner-версию
  без собственного фото. Прямой PATCH demo без согласия даёт ошибку поля.
- [ ] До перехода сохранить ID и все поля owner/converted товаров, упорядоченную
  галерею (ID, URL, main/order/is_mock), stock/reserved, synthetic cart/favorite/order
  связи и `demo_source`. Own-photo товар показывает своё фото; converted без фото
  использует штатное состояние отсутствующей фотографии, не static/demo mock.
- [ ] Однократным управляемым отказом API проверить ошибку перехода: подтверждение
  не сообщает успех, товары/режим не изменены; после снятия отказа повтор работает.
  Сбой внедрять только в изолированном harness/браузерном routing, не в production.
- [ ] Выполнить переход через `/manage`: публичные list/detail/related скрывают
  только оставшиеся `origin=demo`, корзина/checkout не допускают их покупку.
  Owner и converted видны. Их snapshot, реальные файлы, остатки и связи сохранены;
  исходные demo-строки и mock-файлы не удалены. Manage объясняет `demo_disabled`.
- [ ] Повтор POST возвращает ту же дату перехода и не создаёт новых изменений;
  проверить `switched_at` и сохранённого `switched_by` на сервере. Reload SPA,
  restart/redeploy и два обычных seed не возвращают demo на витрину и не меняют
  owner snapshot. Не менять VITE/env и не пересобирать SPA ради перехода.
- [ ] Anonymous/покупатель не может получить управление или выполнить переход.
  При ошибке загрузки состояния есть retry; после восстановления актуальные
  количества и режим показаны верно.

## Автоматические регрессии и граница результата

Из `backend/` в подготовленном venv с **изолированной PostgreSQL**:

```bash
pytest tests/test_manage_catalog_contract.py tests/test_manage_catalog_api.py tests/test_manage_images_api.py tests/test_catalog_api.py tests/test_inventory.py tests/test_seed_catalog.py tests/test_catalog_provenance_migration.py
ruff check .
black --check .
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py spectacular --validate --file /tmp/coffee46-schema.yaml
```

| Требование | Регрессия |
|---|---|
| Все manage пути/методы, JWT, успешные ответы, gallery media type/ошибки | `test_manage_catalog_contract.py`; order DTO/действия дополнительно в `test_manage_orders_contract.py` |
| Anonymous/user запрет CRUD и cutover; staff CRUD/stock/audit | `test_manage_catalog_api.py` |
| Запрет upload/PATCH/DELETE существующего файла без staff; успешная галерея | `test_manage_images_api.py` (отрицательные запросы сохраняют строку и байты файла) |
| Создание скрытого owner с фото → публикация → снятие публикации, обе категории; list/detail/related | `test_owner_publication_lifecycle_is_consistent_across_public_endpoints` |
| Склад 3 → резерв 2 → доступно 1, оплата/webhook/отмена/expiry ровно один раз, 0 и oversell | `test_inventory.py` |
| Гонки последней единицы, оплата/отмена/expiry/recount; конкурирующие manage/cutover/checkout и gallery writes | transaction-тесты `test_inventory.py`, `test_manage_catalog_api.py`, `test_manage_images_api.py`; отдельные PostgreSQL соединения с barrier |
| Metadata, явная конверсия, идемпотентность перехода, owner/связи/фото/stock после seed | `test_manage_catalog_api.py`, `test_seed_catalog.py`, `test_catalog_provenance_migration.py` |
| Пустая будущая витрина, ошибки перехода/формы/галереи и session boundary | существующие Vitest `ManageProducts.test.tsx`, `ManageProductForm.test.tsx`, `ManageProductGallery.test.tsx`; настоящий браузер остаётся отдельной приёмкой |

SQLite не подтверждает PostgreSQL блокировки. Pytest не подтверждает браузер,
Vitest/jsdom не подтверждает настоящее UI, filesystem и SDK fake не подтверждают
cloud storage, mock не подтверждает ЮKassa. В отчёте перечислить выполненные и
невыполненные пункты отдельно; staging AC отмечать выполненным только после
фактического безопасного прогона на названном staging.
