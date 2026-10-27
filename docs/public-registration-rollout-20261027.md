# LUEMI 💜 — открытая настоящая регистрация (Telegram)

**Режим:** любой реальный пользователь Telegram может зарегистрироваться. Никаких beta_invites и синтетических анкет в production. Авторизация всегда подтверждается Telegram initData на сервере, права RLS неизменны.

## Изменение архитектуры

- Пара взаимоисключающих режимов: `REM06_OPEN_SIGNUPS_ENABLED=1` или `REM06_BETA_INVITES_ENABLED=1`, **не оба одновременно**.
- Открытые регистрации требуют явного `REM06_OPEN_SIGNUPS_APPROVED=1` и `REM06_PRIVACY_APPROVED=1`, запущенной `REM05B_SESSIONS_ENABLED=1`, реального Telegram-бота, изолированного issuer DB LOGIN и peer request DB LOGIN.
- Сервер никогда не доверяет браузерному Telegram ID; используется проверенный `initData`.
- Публикация анкет требует независимых одобренных флагов приватного фото-хранилища и **действительно работающей модерации**, а не только созданного bucket.
- Уже имеющаяся `luemi_private.beta_invites` НЕ удаляется и не используется в open signups; изменение политики admission не удаляет пользователей и сессии.
- `VITE_LUEMI_REAL_ONLY=1` + остальные UI VITE-флаги создают production сборку, которая не входит в синтетическую Discovery-колоду.

## Серверная последовательность активации

1. В Supabase Database созданы 10 изолированных NOLOGIN-групповых оболочек, их привилегии раздельны. **До включения** оператор должен назначить каждому LOGIN право входа и уникальный случайный пароль в **Supabase Dashboard**, а connection strings положить в **Render Environment**, не в GitHub, логи или чат.
2. Проверить с самого Render, что каждое соединение действительно проходит: `session_user=current_user`, `row_security=on`, собственная группа доступа (например `luemi_auth_issuer` для issuer), не owner и не service_role. Supabase на IPv4 хостинге рекомендует Session pooler на 5432 — правильный регион и пользователь берутся из Supabase Connect.
3. Подтвердить реальную политику обработки данных, контакт оператора и уведомление пользователей, версию согласия и действующий путь `/privacy`. Без правдоподобной реальной страницы политика `REM06_PRIVACY_APPROVED` должна остаться выключенной.
4. Включить **на сервере** `REM05B_SESSIONS_ENABLED=1`, `REM06_OPEN_SIGNUPS_ENABLED=1`, `REM06_OPEN_SIGNUPS_APPROVED=1`, `REM06_BETA_INVITES_ENABLED=0`. Начальные HTTP запросы проверяются только по подписанной Telegram payload + cookie/CSRF; client-only флаги ничего не разрешают.
5. Включить `REM06_PRIVATE_DRAFT_ENABLED=1`, `REM06_MEDIA_ENABLED=1`, `REM06_MEDIA_BUCKET=luemi-profile-private` и корректные приватные secret/ref, затем `REM06_PUBLICATION_ENABLED=1` только при **фактическом** ручном/moderation процессе и `REM06_MODERATION_OPERATIONAL_APPROVED=1`. Для публикации нужны 3–6 утверждённых фото.
6. Отдельно включить чаты: `LUEMI_CHATS_V1_ENABLED=1`, `LUEMI_CHATS_POLICY_APPROVED=1`, `LUEMI_MATCHES_V1_ENABLED=1`, `LUEMI_MATCHES_POLICY_APPROVED=1`, независимые `LUEMI_CHATS_DATABASE_URL`, `LUEMI_MATCHES_DATABASE_URL`, и `LUEMI_CHATS_MEDIA_ENABLED=1` с bucket `luemi-chat-private`. Перед включением проверить SQL-схему/отзыв доступа при блокировке.
7. Настроить геокодер `REM05C_ENABLED=1`, `REM05C_GEO_PROVIDER_ENABLED=1`, `REM05C_BUDGET_DATABASE_URL`, `GEOAPIFY_API_KEY`, глобальную и vendor квоты. Точная геопозиция используется только для однократной reverse geocoding на явное нажатие; если провайдер недоступен, выбрать город вручную. Не выполнять платные запросы без квот.
8. Только после успешного серверного запуска выполнить **новый Vite build** с `VITE_LUEMI_REAL_ONLY=1`, `VITE_LUEMI_AUTH_V2=1`, `VITE_LUEMI_PRIVATE_DRAFT_UI=1`, `VITE_LUEMI_PRIVATE_MEDIA_UI=1`, `VITE_LUEMI_REAL_DISCOVERY_UI=1`, `VITE_LUEMI_REAL_MATCHES=1`, `VITE_LUEMI_REAL_CHATS=1`, `VITE_LUEMI_GEO_PROVIDER_ENABLED=1`, `VITE_LUEMI_CONSENT_VERSION` и `VITE_LUEMI_PRIVACY_POLICY_PATH`. Проверить соответствие client consent/server consent.

## Реальные проверки

- Пользователь A через Telegram → зарегистрировался → заполнил 8 шагов → выбрал геолокацию → фото одобрены → published; повторный вход должен сразу показать его реальные данные.
- Пользователь B проходит то же независимо. Пользователи видят **друг друга**, но не собственную карточку.
- Взаимные лайки → уникальный матч → реальная переписка (текст/фото) → прочтение, перезагрузка, блокировка и мгновенный отзыв доступа.
- Третий произвольный Telegram-аккаунт может пройти регистрацию самостоятельно, но не может читать чужую приватную анкету/сообщения без разрешения. Это и означает **открытый** режим.
- Проверить на физическом Samsung Galaxy A55, Telegram Android WebView; Github browser QA не заменяет реального устройства.

## Актуальная граница

По состоянию на создание инструкции: приложение и приватные SQL-таблицы доступны; **фактические DB LOGIN credentials в Render не подтверждены**, серверные флаги остаются OFF. Не объявлять публичную регистрацию работающей, пока первые два Telegram-аккаунта не прошли реальные HTTP E2E. Не расширять доступ с помощью service_role, postgres-owner URL или отключения RLS.
