# COFFEE-64: отдельный стенд Django на Vercel + Neon

Этот документ описывает подготовленную конфигурацию и операторскую процедуру.
Наличие файлов в Git не означает, что облачная интеграция уже принята QA.
Старый Render, его БД и существующий frontend `coffee-shop` сохраняются.
Текущий статус старых данных неизвестен: `/api/health/` не читает БД.

## Бюджет и границы

На 01.11.2026 [Vercel Hobby](https://vercel.com/docs/plans/hobby) — бесплатный
план для личного некоммерческого использования. Новый проект предназначен для
разработки и демонстрации, до реальных продаж нужен отдельный выбор тарифа.
Оплачиваемый trial, Pro и автоматическое увеличение бюджета не включать.

[Публичный Neon Free](https://neon.com/pricing) указывает 100 CU-hours и 1 GB
на проект, до 10 branches, остановку неактивного compute через 5 минут и короткое
окно восстановления. Это не независимая резервная копия. Перед созданием ресурса
проверить фактические entitlements выбранного Marketplace-плана `free_v3`:
они могут отличаться от публичной страницы. В evidence записать plan ID, лимиты,
region и branch IDs без credentials. Если доступен только платный вариант,
перенос приостановить; платные ресурсы и карту не подключать.

В этом checkout лимит функции установлен в 30 секунд. Это наш бюджет запроса,
а не утверждение о предельном лимите провайдера. Изображения должны жить во
внешнем storage по COFFEE-41; ни bundle, ни `/tmp` не заменяют постоянный bucket.

## Packaging и сборка

Для **нового backend-проекта** установить Root Directory `backend`, Framework
`Django`. Файлы корневого frontend-проекта `vercel.json` не переносить в backend.
Код использует `backend/vercel.json`, `.python-version` с Python 3.12,
`requirements.txt → requirements/prod.txt → requirements/base.txt` и явный
`tool.vercel.entrypoint = "config.vercel_wsgi:application"` в `pyproject.toml`.
Оба старых WSGI/ASGI settings остаются для прежних сред.

Согласно [native Django docs](https://vercel.com/docs/frameworks/backend/django),
CLI должен быть не ниже 50.38.0. Native preset сам собирает static в CDN;
выбранный build hook только выполняет Django deployment checks. Для CLI/build
зафиксировать фактически использованные версии в evidence, а не полагаться на
локальный alias. Настройки Install/Build/Output Directory нового проекта не
должны наследовать Vite-команды или `backend/build.sh` от Render.

Build не вызывает `migrate`, `seed_catalog`, `createsuperuser`, экспорт данных
или запись в S3. `collectstatic` работает со staticfiles backend, не с media.
Секреты и дампы исключены из upload и function bundle. Dependency manifest
описывает только runtime; тестовые инструменты устанавливаются через
`requirements/dev.txt`. Установка и выбор версии Python описаны в
[Python runtime docs](https://vercel.com/docs/functions/runtimes/python).

## Контракт окружений

`COFFEE_ENVIRONMENT` — назначение приложения, а `VERCEL_ENV` — системная цель
платформы. Production deployment отдельного **staging-проекта** остаётся
`COFFEE_ENVIRONMENT=staging`. Preview/Development платформы не может включить
application production mode.

| Переменная                                      | Назначение                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `DJANGO_SETTINGS_MODULE=config.settings.vercel` | И discovery, и runtime используют отдельные строгие settings                               |
| `COFFEE_ENVIRONMENT=preview` / `staging`        | Изолированный тестовый стенд без платёжных credentials                                     |
| `SECRET_KEY`                                    | Отдельный секрет среды, не ключ старого production                                         |
| `DATABASE_URL`                                  | Pooled PostgreSQL URL **своей** Neon DB/branch; credentials только в secret env            |
| `DATABASE_URL_UNPOOLED`                         | Direct URL той же destination для оператора миграций; web-код его не читает                |
| `ALLOWED_HOSTS`                                 | Конкретные hostname backend alias/custom domain, без схемы, wildcard и ведущей точки       |
| `VERCEL_URL`                                    | Системный hostname конкретного deployment, добавляется к allowlist                         |
| `CORS_ALLOWED_ORIGINS`                          | Только явные HTTPS origins согласованного frontend preview                                 |
| `CSRF_TRUSTED_ORIGINS`                          | Явные HTTPS origins для нужных admin/form сценариев; same-origin admin не требует wildcard |
| `MEDIA_STORAGE=s3` и S3 env COFFEE-41           | Отдельный постоянный bucket/права среды, staticfiles остаётся локальным                    |
| `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`       | Пустые в Preview/Staging; непустые значения приводят к отказу старта                       |

Основной пример env ведётся в `backend/.env.example` задачей COFFEE-41. Не
создавать второй пример с расходящимися ключами. Конфигурация Vercel отказывается
работать с filesystem media и без фактического S3 backend COFFEE-41.

Разделение ресурсов — обязательная часть настройки, не свойство имени переменной:
отдельные DB/branches и роли, secrets, buckets и доступы для Preview и рабочего
стенда. Не копировать production snapshot с покупателями в публичный PR preview.
В dashboard сверить project/branch/resource IDs и env scopes до первой записи.
Автоматическое ветвление Neon не считать настроенным, пока конкретная branch и
её credentials для deployment не проверены. Использовать фиксированную отдельную
preview DB для первой репетиции. Нельзя выдавать preview роль с правами на рабочую БД.

Выбрать близкие Neon и Vercel regions из фактически доступных бесплатных вариантов;
конкретный регион и ресурсные IDs запишет координатор. Не подключать CDN/Redis,
очереди или другие оплачиваемые зависимости, которых нет в приложении.

## PostgreSQL

Оставляем Django ORM + psycopg, без Neon JS SDK. Settings устанавливает
`CONN_MAX_AGE=0`, `DISABLE_SERVER_SIDE_CURSORS=True`, TLS `require` по умолчанию
и connection timeout 10 секунд; режимы отключения/ослабления TLS запрещены.
Более строгие `verify-ca`/`verify-full` из URL сохраняются. Pooled URL берётся из
Neon, а не строится заменой произвольных hostname. Это соответствует
[Neon Django guidance](https://neon.com/docs/guides/django) и
[Django transaction pooling](https://docs.djangoproject.com/en/5.2/ref/databases/#transaction-pooling-and-server-side-cursors).

## Первое развёртывание и demo-данные

Эти действия выполняет координатор на проверенной ревизии после интеграции
отдельно принятых storage/seed изменений COFFEE-41. Ниже нет разрешения изменять
production или автоматически выполнять команды из build.

1. Проверить новые project/resource IDs, free plans и scopes. Подготовить пустую
   отдельную Neon destination, постоянный bucket и env нового backend-проекта.
2. Проверить `vercel --version`, backend root и settings. Запустить обычный
   Preview deploy нового проекта; не переключать существующий frontend alias.
3. Уполномоченный оператор получает direct URL **этой destination** в защищённый
   env. Не выводить `.env`, DSN, tokens или customer records; не использовать `set -x`.
   Сверить в Neon branch ID, DB и role с запланированной тестовой destination.
4. Из `backend/` на той же ревизии выполнить сначала план, затем миграции:

```sh
: "${DATABASE_URL_UNPOOLED:?Set the approved destination direct URL}"
DATABASE_URL="$DATABASE_URL_UNPOOLED" DJANGO_SETTINGS_MODULE=config.settings.vercel \
  python manage.py migrate --plan
DATABASE_URL="$DATABASE_URL_UNPOOLED" DJANGO_SETTINGS_MODULE=config.settings.vercel \
  python manage.py migrate --noinput
```

5. Только для явно обозначенной demo DB вручную выполнить
   `python manage.py seed_catalog --settings=config.settings.vercel` после COFFEE-41.
   Seed создаёт отсутствующие товары, не восстанавливает неизвестные production
   записи и не должен переписывать существующий каталог. Зафиксировать, что это
   **новые демонстрационные данные**, а не восстановленные данные Render.
6. Через защищённую операторскую сессию отдельно создать тестового admin;
   пароль не передавать в CLI arguments или evidence. Проверить upload в S3.
7. Собрать **frontend preview** с `VITE_API_BASE_URL` нового API, добавить именно
   его origin в CORS и передать обе ссылки QA/пользователю. Старый frontend
   production пока использует прежнюю конфигурацию.

## Приёмка целевой среды

В evidence должны быть deployment revision, Python/CLI/dependency versions,
точные frontend/backend URLs, project/branch IDs, источник demo/перенесённых данных
и снимок scopes без значений секретов. Обязательно проверить:

- `/api/health/`, `/api/categories/`, `/api/products/?category=coffee` и поиск/фильтры;
  отдельно чтение БД — один health недостаточен.
- Register/login/refresh/logout на тестовом пользователе; guest cart с
  `X-Cart-Token`, preflight и `Access-Control-Expose-Headers`; запрещённый origin.
- Anonymous/non-staff не получают admin; same-origin admin login и CSRF-защита,
  список/редактирование разрешённых сущностей, неизменность платёжных полей.
- `/static/admin/css/base.css` и JS через CDN; загрузка картинки через admin,
  gallery/main flags, URL изображения после redeploy/cold invocation. Нет media
  из эфемерного filesystem и нет повторной seed-записи после build.
- Изоляция Preview от рабочей DB/bucket и отказ при payment credentials;
  реальных платежей и production заказов в QA не создавать.

Локальные pytest/settings/static tests не доказывают Vercel CDN, Neon TLS,
фактические CORS headers или постоянство S3. До этих проверок полная приёмка
COFFEE-64 остаётся незавершённой.

## Старые данные, cutover и rollback

Render не удалять и не перезаписывать. Если старая БД недоступна, явно сохранить
статус «экспорт не получен, сохранность неизвестна». Demo-каталог не является
backup. Экспорт реальных данных, восстановление и финальный cutover требуют
отдельно подтверждённого источника и согласованного результата.

Для репетиции backup/restore использовать direct connections, совместимые
версии `pg_dump`/`pg_restore` и свежую пустую destination. Оператор настраивает
защищённые libpq service/password files вне Git (`PGSERVICEFILE`, `PGPASSFILE`,
права 0600). В командах остаются только несекретные service names:

```sh
umask 077
: "${COFFEE_BACKUP_DIR:?Set a secure ignored backup directory}"
pg_dump --dbname="service=coffee-render-source" --format=custom --no-owner --no-acl \
  --file="$COFFEE_BACKUP_DIR/coffee.dump"
pg_restore --list "$COFFEE_BACKUP_DIR/coffee.dump" > "$COFFEE_BACKUP_DIR/coffee.list"
pg_restore --dbname="service=coffee-neon-rehearsal" --exit-on-error --no-owner --no-acl \
  "$COFFEE_BACKUP_DIR/coffee.dump"
```

После восстановления проверить counts, связи, constraints, sequence values,
representative records и object keys. Дампы/списки содержат чувствительные данные:
не коммитить и не публиковать в Jira. Не продолжать после неуспешного restore;
для повтора нужна новая пустая destination. Откат приложения не откатывает схему.

Перед реальным переключением отдельно зафиксировать окно и ответственного:
остановить старые writers/admin/платёжные callback mutations, получить финальный
экспорт, проверить destination, применить совместимые миграции и подтвердить
пользовательский просмотр. Только затем менять frontend production API URL,
allowed origins и callback/webhook адреса. Сохранить `SECRET_KEY`/JWT и YooKassa
конфигурацию согласно отдельному плану совместимости сессий; staging credentials
не заменяют production. Путь webhook сейчас `/api/payments/webhook/`, return URL
должен вести на согласованный frontend `/checkout/result`.

Для отката до новых записей вернуть прежний проверенный frontend deployment/env
и API routing. После новых записей сначала определить единственную авторитетную
БД и согласовать перенос новых изменений: простое переключение на старую БД
теряет новые данные. Не запускать два набора writers или webhook обработчиков
одновременно. Сохранить старые ресурсы и резервные копии на согласованное окно;
удаление не входит в этот перенос. Практические ограничения описаны в
[официальном Render → Vercel guide](https://vercel.com/kb/guide/migrate-a-python-api-from-render-to-vercel).
