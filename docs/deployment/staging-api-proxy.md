# COFFEE-70: API через домен staging-витрины

Это операторский manifest, а не автоматически применяемый `vercel.json`.
[infra/vercel/staging-api-proxy.json](../../infra/vercel/staging-api-proxy.json)
содержит точный payload добавления project-level route и две несекретные
Production env правки. Публиковать только после независимого review. Наличие
файла не подтверждает работоспособность сети или прохождение QA.

## Границы

- Team: `team_0UzX2haAGEQFdTiDaNELNV3q`.
- Новый frontend: `prj_ypWNyEkBt3dWGAPxQZ3Tv4QtML7M`, Root Directory `frontend`.
- Новый API: `prj_wKMKtr1996KtVQGhP4CvMjbAA9vp`, Root Directory `backend`.
- Старый production `prj_eWOYxivVxIYCdXbqUlBTxUJD76sC`, корневой
  `vercel.json`, Render, Preview env/БД и URL webhook ЮKassa не менять.
- Не создавать ресурсы, middleware/functions, credentials или зависимости.

Правило применяется только к hostname
`coffee-shop-staging-mariaklimovas-projects.vercel.app` и регистрозависимому
пути `/api/…`. Immutable deployment URLs и preview aliases под условие host не
попадают; проверять прокси через stable URL. Query не подменяется; методов,
тел и auth/cart заголовков правило не фильтрует и не преобразует. Destination
фиксирован, пользователь не может выбрать другой upstream. `/admin/`, static,
карточки `/product/:slug` и SPA fallback остаются в маршрутизации витрины.
Неизвестный `/api/…` должен вернуть ошибку API, а не HTML витрины.

`/api/cart/` сохраняет завершающий slash. Не делать redirects между origin:
иначе клиент снова потребуется соединять с отдельным API hostname, а POST
может потерять тело. Проверять также пути без slash; если Django перенаправляет
их, `Location` должен оставаться на origin витрины. Клиентские API вызовы уже
используют slash. Голый `/api` в правило не входит.

`USE_X_FORWARDED_HOST=True` в строгих Vercel settings сохраняется. Vercel
передаёт оригинальный frontend host в `X-Forwarded-Host`, поэтому точный host
витрины добавляется в backend `ALLOWED_HOSTS` рядом с существующим API host.
Wildcard, подмена forwarded headers, отключение host/CSRF/IP проверок не нужны.
Существующий frontend origin уже разрешён CORS; его настройки и test-only
проверки ЮKassa не менять. Webhook по-прежнему приходит напрямую в API.

Для всех ответов прокси, включая каталог, отключён CDN cache; браузер получает
`Cache-Control: private, no-store`. `CDN-Cache-Control` и
`Vercel-CDN-Cache-Control` также `no-store`, а
`x-vercel-enable-rewrite-caching: 0` явно отключает external rewrite cache.
Не заменять это кешированием по URL или только `Vary`: корзина идентифицируется
bearer/cart заголовками. На QA проверять фактические заголовки, а не только файл.

## Применение координатором

1. Сохранить SHA, deployment IDs/aliases обоих staging проектов, текущие
   несекретные значения этих двух env, их target/branch и опубликованную версию
   routing rules в `.runtime-COFFEE-70/`. Проверить IDs и Root Directory по API.
   На baseline 01.11.2026 правила `[]`, version `null`; оба env Production-only.
   При расхождении с `previousValue` остановиться и пересмотреть manifest;
   не затирать новые настройки. Секреты не читать и не выгружать.
2. Изменить только существующий Production `ALLOWED_HOSTS` нового API согласно
   manifest. Redeploy проверенного staging SHA; дождаться READY и health 200
   через доступный remote fetch. Код/settings backend не меняются. Не запускать
   миграции, seed, изменения DB/storage или provider API.
3. Вызвать Vercel `add_route` с объектом `addRoute` из manifest. Это создаёт
   staged routing version. Прочитать её обратно, сверить единственное правило,
   host/path, destination и cache headers. Сохранить route/version IDs.
   Не публиковать чужие staged изменения вместе с этим правилом.
4. Опубликовать проверенную staged version через `update_route_versions`
   с `action: promote` и полученным ID, теми же team/project IDs. Readback
   подтвердить published version. До изменения frontend env проверить через
   stable frontend `/api/health/`, `/api/products/?page_size=1` и
   неизвестный API путь: ожидаются JSON/API error и no-store, без redirects
   на API origin. При 400 Host или HTML не продолжать.
5. Изменить только существующий Production `VITE_API_BASE_URL` нового frontend
   на `/`. Не трогать другие targets/branches. Deploy staging-ветки с reviewed
   HTTP refresh fix этой задачи: старый код склеивает `/` с `/api/…` и получает
   protocol-relative `//api/…`. В новом коде Axios соединяет baseURL и path.
   Дождаться READY, записать deployment ID, SHA и stable alias. Изменение env
   не переписывает уже собранный JS; нужен новый frontend build/deploy.
6. Передать точную ревизию независимому QA. Браузер должен запрашивать API
   через frontend origin. Проверить каталог/query, две изолированные guest
   корзины и возврат cart token; auth/refresh и защищённый отказ; JSON POST/PATCH/
   DELETE на собственных QA fixtures с сохранением метода/тела; отсутствие
   cache HIT/private смешивания; ошибки/unknown API; deep link товара и static.
   Повторить COFFEE-65/67/68/69. Не читать или изменять пользовательские заказы.
   Реальная тестовая оплата/вебхук принимается отдельно по COFFEE-67.

## Rollback

При неуспешном staged readback до публикации — `discard` только своей staged
version. При runtime ошибке сначала вернуть frontend на сохранённый deployment
с прежним абсолютным API base, затем вернуть Production env `VITE_API_BASE_URL`
к `previousValue`, чтобы последующие builds тоже откатились. Это возвращает
исходный сетевой блокер, но не выдаёт сломанную версию за исправленную.

Восстановить предыдущую опубликованную routing version через `restore`, если
она существовала. Для baseline `version:null` удалить только созданное правило
по сохранённому route ID, проверить staged diff `[]`, опубликовать полученную
пустую version и подтвердить readback; не передавать `null` как restore ID и не
удалять чужие правила. Вернуть backend Production `ALLOWED_HOSTS` к сохранённому
значению и предыдущий backend deployment. Записать итоговые aliases/env/routes.
Backend host addition можно откатить последним, чтобы не создавать промежуточный
400 для ещё опубликованного proxy. Секреты, webhook и данные не менять.

## Источники

- [Vercel project routing rules](https://vercel.com/docs/routing/project-routing-rules):
  порядок правил, host conditions, stage/publish и rollback.
- [External rewrites](https://vercel.com/docs/routing/rewrites): forwarding
  headers и явное отключение rewrite caching.
- [Vercel env](https://vercel.com/docs/environment-variables): target scope;
  новое значение применяется к новым deployments.
