import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "./config.js";

const PAGE_SIZE = 20;
export type AdminUsersPage = { total: number; rows: { id: string; username: string | null }[] };
export type AdminUsersLookup = (page: number) => Promise<AdminUsersPage | null>;

export function formatAdminUsers(result: AdminUsersPage, page: number): string {
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const lines = result.rows.map((row, i) =>
    `${(page-1)*PAGE_SIZE+i+1}. ID: ${row.id} · ${row.username && /^[A-Za-z0-9_]{1,32}$/.test(row.username) ? "@"+row.username : "username недоступен"}`);
  return ["LUEMI 💜 — зарегистрированные пользователи", `Всего: ${result.total}`,
    `Страница ${page} из ${pages}`, "", ...lines,
    ...(lines.length ? [] : ["На этой странице нет пользователей."]),
    ...(page < pages ? [`Далее: /users ${page+1}`] : []),
    ...(page > 1 ? [`Назад: /users ${page-1}`] : [])].join("\n");
}

async function telegramUsername(token: string, id: string, fallback: string | null): Promise<string | null> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ chat_id: id }), signal: AbortSignal.timeout(1800)
    });
    if (!response.ok) return fallback;
    const data = await response.json() as {ok?: boolean;result?: {id?: number; type?: string; username?: string}};
    if (!data.ok || data.result?.type !== "private" || String(data.result.id) !== id) return fallback;
    const username = data.result.username;
    return typeof username === "string" && /^[A-Za-z0-9_]{1,32}$/.test(username) ? username : null;
  } catch { return fallback; }
}

export function createAdminUsersLookup(app: FastifyInstance, config: ApiConfig): AdminUsersLookup {
  const admin = config.adminUsers;
  const namespace = config.rem05b?.namespace;
  if (!admin?.databaseUrl || !namespace || !config.realPublication?.enabled ||
      namespace !== config.realPublication.namespace || !config.botToken) return async () => null;
  const pool = new Pool({connectionString: admin.databaseUrl, max: 2,
    connectionTimeoutMillis: 1500, statement_timeout: 1800, query_timeout: 2200});
  app.addHook("onClose", async () => { await pool.end(); });
  return async page => {
    if (!Number.isSafeInteger(page) || page < 1 || page > 999999) return null;
    const db = await pool.connect();
    let result: AdminUsersPage;
    try {
      const check = await db.query<{safe:boolean}>(`
        SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
          AND NOT r.rolcreatedb AND session_user=current_user
          AND pg_has_role(current_user,'luemi_admin_users_reader','member')
          AND NOT pg_has_role(current_user,'luemi_auth_issuer','member')
          AND NOT pg_has_role(current_user,'luemi_profile_publisher','member')
          AND NOT pg_has_role(current_user,'luemi_request','member')
          AND NOT pg_has_role(current_user,'pg_read_all_data','member')
          AND NOT pg_has_role(current_user,'pg_write_all_data','member')
          AND NOT has_schema_privilege(current_user,'luemi_private','CREATE')
          AND row_security_active('luemi_private.actors'::regclass)
          AND row_security_active('luemi_private.public_profiles'::regclass)
          AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
          AND NOT has_column_privilege(current_user,'luemi_private.actors','first_name','SELECT')
          AND NOT has_column_privilege(current_user,'luemi_private.public_profiles','about','SELECT')
          AND NOT has_column_privilege(current_user,'luemi_private.actors','telegram_username','UPDATE')
        ) AS safe FROM pg_roles r WHERE rolname=current_user`);
      if (check.rows[0]?.safe !== true) return null;
      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await db.query("SELECT set_config('luemi.environment',$1,true)", [namespace]);
      const source = "FROM luemi_private.actors a JOIN luemi_private.public_profiles p ON p.owner_id=a.id AND p.environment=a.environment WHERE a.environment=$1 AND a.status='active' AND p.publication_status='published'";
      const total = await db.query<{total:string}>("SELECT count(*)::text AS total "+source,[namespace]);
      const rows = await db.query<{id:string;username:string|null}>(
        "SELECT a.telegram_id::text AS id,a.telegram_username AS username "+source+
        " ORDER BY p.published_at DESC NULLS LAST,a.telegram_id LIMIT $2 OFFSET $3",
        [namespace,PAGE_SIZE,(page-1)*PAGE_SIZE]);
      await db.query("COMMIT");
      result = {total:Number(total.rows[0].total),rows:rows.rows};
    } catch {
      await db.query("ROLLBACK").catch(()=>{});
      return null;
    } finally { db.release(); }
    // The Bot API can resolve chats it knows, but older Mini App-only accounts
    // may be inaccessible. Retain the last verified username, not a guess.
    result.rows = await Promise.all(result.rows.map(async row => ({
      id:row.id, username:await telegramUsername(config.botToken,row.id,row.username)
    })));
    return result;
  };
}
