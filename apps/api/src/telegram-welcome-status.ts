import { Pool, type PoolClient } from "pg";
import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "./config.js";

export type WelcomeState = "new" | "registered" | "unknown";
export type WelcomeStatusLookup = (telegramId: number) => Promise<WelcomeState>;

// A /start update is Telegram-authenticated by the webhook secret. Use the
// existing isolated issuer/publisher principals; never accept a Telegram ID
// from an HTTP caller or use a database-owner credential.
async function roleSafe(db: PoolClient, role: "luemi_auth_issuer" | "luemi_profile_publisher"): Promise<boolean> {
  try {
    const row = await db.query<{ safe: boolean }>(
      "SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls " +
      "AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND session_user=current_user " +
      "AND current_setting('row_security')='on' " +
      "AND pg_has_role(current_user,$1::name,'member') " +
      "AND NOT pg_has_role(current_user,'pg_read_all_data','member') " +
      "AND NOT pg_has_role(current_user,'pg_write_all_data','member') " +
      "AND NOT has_schema_privilege(current_user,'luemi_private','CREATE') " +
      "AND CASE WHEN $1='luemi_auth_issuer' " +
      "THEN row_security_active('luemi_private.actors'::regclass) " +
      "AND NOT pg_has_role(current_user,'luemi_profile_publisher','member') " +
      "AND has_table_privilege(current_user,'luemi_private.actors','SELECT') " +
      "ELSE row_security_active('luemi_private.public_profiles'::regclass) " +
      "AND NOT pg_has_role(current_user,'luemi_auth_issuer','member') " +
      "AND has_column_privilege(current_user,'luemi_private.public_profiles','publication_status','SELECT') END" +
      ") AS safe FROM pg_roles r WHERE r.rolname=current_user", [role]
    );
    return row.rowCount === 1 && row.rows[0].safe === true;
  } catch { return false; }
}

/**
 * Only used for button copy; failing closed keeps account existence private
 * and lets the app perform its own authenticated routing when opened.
 */
export function createWelcomeStatusLookup(app: FastifyInstance, config: ApiConfig): WelcomeStatusLookup {
  const auth = config.rem05b;
  const pub = config.realPublication;
  if (!auth?.enabled || !pub?.enabled || !auth.issuerDatabaseUrl ||
      !pub.publisherDatabaseUrl || auth.namespace !== pub.namespace)
    return async () => "unknown";

  const issuer = new Pool({
    connectionString: auth.issuerDatabaseUrl, max: 2,
    connectionTimeoutMillis: 1200, statement_timeout: 1400, query_timeout: 1800
  });
  const publisher = new Pool({
    connectionString: pub.publisherDatabaseUrl, max: 2,
    connectionTimeoutMillis: 1200, statement_timeout: 1400, query_timeout: 1800
  });
  app.addHook("onClose", async () => { await Promise.all([issuer.end(), publisher.end()]); });

  return async (telegramId: number): Promise<WelcomeState> => {
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return "unknown";
    let actorId: string | undefined;
    const client = await issuer.connect().catch(() => null);
    if (!client) return "unknown";
    try {
      if (!await roleSafe(client, "luemi_auth_issuer")) return "unknown";
      await client.query("BEGIN");
      await client.query("SELECT set_config('luemi.environment',$1,true)", [auth.namespace]);
      await client.query("SELECT set_config('luemi.telegram_id',$1,true)", [String(telegramId)]);
      const actor = await client.query<{ id: string }>(
        "SELECT id FROM luemi_private.actors " +
        "WHERE environment=$1 AND telegram_id=$2 AND status='active' LIMIT 1",
        [auth.namespace, String(telegramId)]
      );
      await client.query("COMMIT");
      actorId = actor.rows[0]?.id;
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      return "unknown";
    } finally { client.release(); }
    if (!actorId) return "new";

    const db = await publisher.connect().catch(() => null);
    if (!db) return "unknown";
    try {
      if (!await roleSafe(db, "luemi_profile_publisher")) return "unknown";
      await db.query("BEGIN");
      await db.query("SELECT set_config('luemi.actor_id',$1,true)", [actorId]);
      await db.query("SELECT set_config('luemi.environment',$1,true)", [pub.namespace]);
      const profile = await db.query<{ publication_status: string }>(
        "SELECT publication_status FROM luemi_private.public_profiles " +
        "WHERE owner_id=$1 AND environment=$2", [actorId, pub.namespace]
      );
      await db.query("COMMIT");
      return profile.rows[0]?.publication_status === "published" ? "registered" : "new";
    } catch {
      await db.query("ROLLBACK").catch(() => {});
      return "unknown";
    } finally { db.release(); }
  };
}
