> **УСТАРЕВШАЯ ИНСТРУКЦИЯ / НЕ ИСПОЛЬЗОВАТЬ ДЛЯ ЗАПУСКА.** 28 октября владелец утвердил публичный LUEMI для всех подходящих пользователей Telegram. Актуальный источник решения — [PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md). Приведённые ниже ограничения на двух пользователей относятся только к историческому плану; **не включать** beta-only admission, не требовать Telegram ID и whitelist. Скрипт настройки credentials теперь запускается в режиме `open`.

# LUEMI 💜 — закрытое тестирование двух настоящих Telegram-аккаунтов

Дата: 2026-10-27. Режим: **строго два приглашённых Telegram пользователя**, без синтетических анкет. Этот план не разрешает превращать включение feature flags в обход безопасности.

## Что уже делает код
- Telegram `/myid` в личном чате возвращает **только собственный Telegram numeric ID**. Точный ID используется для `luemi_private.beta_invites`.
- После действительной V2-сессии регистрация сохраняет данные в `luemi_private.private_profile_drafts`; публикация происходит только после приватной загрузки 3–6 фотографий и их утверждения.
- Опубликованный пользователь на следующем входе минует регистрацию, входит в реальный домашний экран «Знакомства / Чаты / Профиль».
- `VITE_LUEMI_REAL_ONLY=1` запрещает показ синтетической Discovery-ленты. Если реальные функции не включены, страница отказывает в демо вместо выдачи фиктивного аккаунта.
- `GeoPicker` сначала использует Telegram LocationManager, затем браузерный GPS, только после нажатия пользователем. Координаты не входят в опубликованный payload, отправляются по HTTPS к серверному геокодеру для определения города. При отказе отображается ручной ввод.
- Реальная лента получает анкеты исключительно из авторизованного API. Взаимный лайк может создать одну переписку; права RLS проверяются сервером.

## Обязательные входные условия перед активацией
1. **Два точных Telegram numeric ID.** Оба участника отправляют `/myid` в личный чат @LuemiAppBot. Оператор вносит *ровно эти два* ID в `luemi_private.beta_invites` для реального `REM05B_BOT_NAMESPACE`. Нельзя использовать имена аккаунтов или угадывать ID. Третьим пользователям доступ запрещён.
2. **Изолированные PostgreSQL LOGIN credentials** на той же реальной базе, но с непересекающимися ролями `luemi_auth_issuer`, `luemi_request`, `luemi_media_worker`, `luemi_profile_publisher`, `luemi_discovery_reader`, `luemi_match_writer`, `luemi_chats_writer` и при геокодировании `luemi_geo_budget`. Сейчас в Supabase видны только **NOLOGIN** роли. Не использовать `postgres`, `service_role` или owner URL в HTTP API. Проверить возможность соединения из Render (session pooler, если нужен IPv4). Не выводить пароли в лог.
3. **Приватное хранилище профилей** `luemi-profile-private` и работоспособный server-only storage secret, worker и механизм модерации. Нельзя автоматически одобрять произвольные непроверенные изображения, обходить `pending_review` или объявлять публикацию успешной до `state='published'`.
4. **Геокодирование города:** включить существующий REM05C Geoapify provider с собственным server-only `GEOAPIFY_API_KEY`, ролью budget, `REM05C_GEO_PROVIDER_ENABLED=1`, малой положительной глобальной дневной квотой и квотами на актёра. Для двух тестеров хватит ограниченного бюджета; не включать неопределённые платные запросы. `VITE_LUEMI_GEO_PROVIDER_ENABLED=1` только после проверки серверного endpoint. Требуется подтверждение политики раскрытия координат внешнему геокодеру.
5. Принятая политика приватности и согласие пользователей (`REM06_PRIVACY_APPROVED`, `REM06_CONSENT_VERSION`, клиентский `VITE_LUEMI_CONSENT_VERSION` и локальный URL политики). Серверные флаги должны соответствовать реально утверждённой операционной модерации.

## Безопасная последовательность переключения
1. Провести CI (web/api lint, types, PostgreSQL 16/17 RLS), проверить историю миграций. Проверить `storage.buckets` и Policies. Не стирать существующие данные.
2. Создать *исключительно* изолированные LOGIN-учётные записи БД, обеспечить их connection strings через Render env без публикации в GitHub. Проверить их привилегии для фактических запросов.
3. Внести ровно два `telegram_id` в `luemi_private.beta_invites`; убедиться, что секретный V2 путь требует invite **до** выдачи сессии.
4. Сначала включить и проверить серверные REM05B V2 session и beta invite gates; затем private draft, private media and moderation, publication/discovery, matching, chat. Рекомендуемые названия см. `apps/api/src/config.ts`. Не включать сервис, если конфигурация не проходит fail-closed checks.
5. Только после работоспособного API активировать компиляционные UI флаги `VITE_LUEMI_AUTH_V2=1`, `VITE_LUEMI_PRIVATE_DRAFT_UI=1`, `VITE_LUEMI_PRIVATE_MEDIA_UI=1`, `VITE_LUEMI_REAL_DISCOVERY_UI=1`, `VITE_LUEMI_REAL_MATCHES=1`, `VITE_LUEMI_REAL_CHATS=1`, `VITE_LUEMI_REAL_ONLY=1`, согласие/политику, и `VITE_LUEMI_GEO_PROVIDER_ENABLED=1` при готовности геокодера. Эти значения нужно внедрить **до сборки Vite** и сделать новый деплой.
6. Под двумя реальными Telegram-аккаунтами пройти 8 шагов регистрации, определить город кнопкой, загрузить 3–6 фото, провести реальную проверку и публикацию. Повторный вход каждого аккаунта должен сразу открыть опубликованную анкету.
7. Выполнить взаимный лайк, отправку/получение текста/фото, непрочитанные, soft-delete, блокировку и проверку немедленного отзыва доступа. Проверить на Samsung Galaxy A55/Telegram WebView; Android matrix CI не равен физическому QA.
8. Проверить, что третьему реальному Telegram-аккаунту приходит `invitation_required` и что синтетическая Discovery-колода в production недостижима.

## Откат
- При любой проблеме немедленно отключить UI-флаги реального аккаунта (с новым Vite build) и server-side `LUEMI_CHATS_V1_ENABLED=0` / `LUEMI_MATCHES_V1_ENABLED=0`; **не удалять** пользователей, медиа или сообщения.
- При необходимости закрыть invite state конкретного ID, отозвать его сессии штатным путём и проверить `RLS`; не трогать других.
- Сохранить миграции (после появления данных — только forward-fix, не destructive rollback).

## Фактический статус · 27 октября 2026 (закрытая бета)

- В Supabase `luemi_private.beta_invites` есть **ровно два активных приглашения** для `luemi-beta-20261027`, других активных приглашений в этом пространстве нет. Личные Telegram ID намеренно НЕ публикуем в GitHub.
- Render `luemi` использует `REM05B_BOT_NAMESPACE=luemi-beta-20261027`. Код PR #117 объединён с `main`, деплой `dep-dbgfvvi9lscs73f2glo0` подтверждён LIVE.
- Файлы профиля и чатов располагаются в закрытых Supabase Storage buckets: `luemi-profile-private` и `luemi-chat-private`.
- В Supabase применена миграция `luemi_two_account_beta_role_shells`: создано 10 ролей с раздельными группами привилегий, все `NOLOGIN`, без паролей и без суперпользовательских прав. Её SQL зафиксирован в `db/closed-beta/role-shells.sql` для аудита. **Не запускать повторно:** уже применена.
- Реальных `actors`, черновиков, публичных анкет и сообщений на момент проверки **0**. Регистрация пока НЕ активна; не заявлять обратное.

## Автоматизированная настройка DB-подключений через защищённый GitHub Actions (без паролей в чате)

Добавлен ручной workflow `.github/workflows/luemi-beta-provision.yml` и скрипт `scripts/closed-beta-bootstrap.mjs`. Это альтернативный, менее трудоёмкий путь к пунктам 1–3 ниже. Процедура **не включает** регистрацию, платежи, геокодер, модерацию или чаты; для реального запуска по-прежнему необходима проверка политик и 2 Telegram E2E.

1. В GitHub `Settings → Environments` создать окружение `beta-bootstrap`, по возможности включить защиту `Required reviewers`. Там же сохранить два *Environment Secrets*, а не значения в открытом workflow:
   - `BETA_SUPABASE_OWNER_URL`: **полная** строка `Session pooler` для проекта LUEMI, взятая непосредственно из `Supabase → Connect`. Требуется порт `5432` и пользователь `postgres.czzyoxrwtnvbicypwrdd`. Не угадывать регион или индекс хоста.
   - `BETA_RENDER_API_KEY`: API key администратора Render из `Render → Account Settings`. Не передавать ключ никому и не вставлять его в чат.
2. В `GitHub → Actions → LUEMI beta DB and Render secret bootstrap (manual) → Run workflow` выбрать **main**. Код тестирует валидность групп доступа и безопасность DB-подключения, назначает отдельные случайные пароли 8 существующим `NOLOGIN`-ролям, передаёт только серверные connection strings и pepper в Render, затем разрешает `LOGIN` и проверяет каждый аккаунт через Supavisor. Роли оператора модерации и удаления остаются `NOLOGIN`.
3. Проверить сообщение `BETA_DB_BOOTSTRAP_OK` и в Supabase — отсутствие новых ролей с `SUPERUSER`/`BYPASSRLS`. При ошибке скрипт пытается перевести все 8 ролей обратно в `NOLOGIN`. После неуспеха **не включать** флаги — сначала проверить роли и настройки.
4. Даже при успехе workflow нужны `REM06_SUPABASE_STORAGE_SECRET` и `REM06_SUPABASE_PROJECT_REF` **на Render**, приватный bucket `luemi-profile-private`, политика данных, разрешение на обработку фотографий, человеческая модерация и корректно настроенный геокодер. Их нельзя заменить ролью DB.
5. После завершения закрытой беты **удалить** временные environment secrets `BETA_SUPABASE_OWNER_URL` и `BETA_RENDER_API_KEY` из GitHub Settings либо ограничить повторные запуски workflow. Сами API/database пароли хранить и менять в секретном хранилище, не выводить в логи.

Документы Supabase и Render подтверждают: custom-user имя Session pooler имеет вид `ROLE.PROJECT_REF`, а endpoint для одного server env `PUT /v1/services/{serviceId}/env-vars/{envVarKey}`; изменение env в REST API само по себе **не означает** включение пользовательских feature flags.

## Дополнительная возможность без платного геокодера (28 октября 2026)

Код `REM05C_LOCAL_REVERSE_ENABLED=1` при `REM05C_ENABLED=1` и действительной V2-сессии даёт однократное определение **только города** по координатам на собственном сервере без обращений к третьим сторонам и без сохранения GPS в профиле. Никакой Geoapify API key и внешних запросов для локального reverse не требуется.

Доступны центры и небольшие радиусы: Краснодар (22 км), Москва (18), Санкт-Петербург (18), Ереван (15), Армавир (Армения, 12), Гюмри (13), Тбилиси (17). **В других городах результат 404 — пользователь выбирает город вручную; координаты никогда не сопоставляются с ближайшим далёким городом.** Это ограниченный режим для предварительного теста, не всемирный геокодер.

При включённом сервере и проверенной кнопке в Telegram новый Vite build может установить `VITE_LUEMI_GEO_LOCAL_ENABLED=1`. В приложении появляется предупреждение об ограниченной географии. `VITE_LUEMI_GEO_PROVIDER_ENABLED` и `REM05C_GEO_PROVIDER_ENABLED` оставлять `0`, если Geoapify не подключён. Нельзя включать обе возможности в обход подтверждённой сессии, информирования и согласия.

**Отдельно:** production V2 теперь отказывается запускаться, если ни `REM06_BETA_INVITES_ENABLED`, ни `REM06_OPEN_SIGNUPS_ENABLED` не включены. Выбор режима обязателен и должен быть осознанным: для двух людей — `beta`. Автоматически переводить старую бета-базу в открытый режим не следует.

## Единственный безопасный путь к активации

**Требуется действие оператора с секретами внутри Supabase Dashboard и Render Dashboard, не в чате и не в GitHub.** Пароли нельзя отправлять AI в тексте, коммитить или логировать.

1. Для каждой из ролей ниже назначить отдельный длинный случайный пароль и разрешить `LOGIN` через защищённый SQL Editor Supabase. Каждая роль имеет только **одну** конкретную группу доступа (см. SQL-миграцию). Не выдавать `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, не использовать Postgres owner/password на API.
2. Внести соответствующие **серверные** connection strings только в Render Environment и проверить фактический вход с Render, `session_user=current_user`, `row_security=on`, запрет чтения чужих таблиц и RLS. Для Free IPv4 может понадобиться именно **Session pooler** с портом `5432` (не transaction pooler), но точный host/username взять из Supabase Connect; примеры из документации нельзя считать проверенными.
3. Таблица соответствия:

| Render env | DB LOGIN user | Privilege group |
|---|---|---|
| `REM05B_AUTH_DATABASE_URL` | `luemi_beta_auth` | `luemi_auth_issuer` |
| `REM05B_REQUEST_DATABASE_URL` | `luemi_beta_request` | `luemi_request` |
| `REM06_MEDIA_WORKER_DATABASE_URL` | `luemi_beta_media` | `luemi_media_worker` |
| `REM06_PUBLISHER_DATABASE_URL` | `luemi_beta_publisher` | `luemi_profile_publisher` |
| `REM06_DISCOVERY_DATABASE_URL` | `luemi_beta_discovery` | `luemi_discovery_reader` |
| `LUEMI_CHATS_DATABASE_URL` | `luemi_beta_chats` | `luemi_chats_writer` |
| `LUEMI_MATCHES_DATABASE_URL` | `luemi_beta_matches` | `luemi_match_writer` |
| `REM05C_BUDGET_DATABASE_URL` | `luemi_beta_geo` | `luemi_geo_budget` |
| operator-only (NOT ordinary Render API) | `luemi_beta_human` | `luemi_human_moderator` |
| `REM06_ERASURE_REQUEST_DATABASE_URL` (policy approval required) | `luemi_beta_erasure` | `luemi_erasure_requester` |

4. Для каждого флага конфигурации подтвердить необходимые реальные политики/согласия: `REM06_PRIVACY_APPROVED`, `REM06_BETA_INVITES_APPROVED`, `REM06_MODERATION_OPERATIONAL_APPROVED`, `LUEMI_CHATS_POLICY_APPROVED`, `LUEMI_MATCHES_POLICY_APPROVED` — **не проставлять 1 автоматически**. Проверить actual revision privacy notice and operator review capability.
5. Только после необходимых политик/доступов и проверки двух аккаунтов последовательно включить серверные `REM05B_SESSIONS_ENABLED`, `REM06_BETA_INVITES_ENABLED`, `REM06_PRIVATE_DRAFT_ENABLED`, `REM06_MEDIA_ENABLED`, `REM06_PUBLICATION_ENABLED`, `LUEMI_CHATS_V1_ENABLED`, `LUEMI_MATCHES_V1_ENABLED`. Client-side `VITE_*` values требуют **новой сборки**. Для реальной GPS reverse дополнительно нужен геокодер, ключ Geoapify и безопасные лимиты.
6. Фотографии 3–6 должны проходить настоящую ручную модерацию через `apps/api/src/human-moderation.ts`; `pending_review` нельзя автоматически считать одобренными. Проверить публикацию, повторный вход, Discovery/mutual match/chats и запрет для третьего аккаунта на настоящих устройствах.

**Status gate:** приглашения готовы; NOLOGIN role shells готовы; подключения/секреты/операционная модерация/политики/реальное E2E ещё не подтверждены. Не включать real-only клиент до полной серверной готовности.
