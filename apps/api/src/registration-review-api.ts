import { timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { safeDb } from './rem05d-private.js';

type Guard = {
 read: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
 mutation: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};
export type RegistrationReviewOptions = {
 enabled: true;
 databaseUrl: string;
 namespace: string;
 consentVersion: string;
 botToken: string;
 adminChatId: string;
};
export function reviewNotificationMessage(id: string, count: number): string {
 if (!/^[0-9a-f]{8}-[0-9a-f-]{28}$/i.test(id) ||
     !Number.isSafeInteger(count) || count < 3 || count > 6)
  throw new Error('invalid_review_notification');
 // Avoid sending names, DOB, media, Telegram IDs or private Storage keys.
 return 'LUEMI 💜 Новая анкета ожидает модерации\n' +
   'Заявка: ' + id.slice(0,8) + '…\n' +
   'Фото на проверке: ' + count + '\n' +
   'Публикация заблокирована до решения модератора.';
}
export async function deliverRegistrationReview(
 token: string, chatId: string, message: string,
 transport: typeof fetch = fetch,
): Promise<boolean> {
 if (!/^\d{6,12}:[A-Za-z0-9_-]{20,}$/.test(token) ||
     !/^[1-9]\d{4,19}$/.test(chatId)) return false;
 try {
  const response=await transport('https://api.telegram.org/bot'+token+'/sendMessage',{
   method:'POST', headers:{'Content-Type':'application/json'},
   body:JSON.stringify({chat_id:chatId,text:message,disable_web_page_preview:true}),
   redirect:'error',signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)return false;
  const value:unknown=await response.json();
  return !!value&&typeof value==='object'&&'ok' in value&&value.ok===true;
 }catch{return false;}
}
/** No moderator approval inside Telegram: bot is notification-only until a
 * separately scoped human-review UI and private photo preview are audited. */
export function registerRegistrationReview(
 app:FastifyInstance,guard:Guard|undefined,config?:RegistrationReviewOptions,
):void{
 if(!config?.enabled)return;
 if(!guard||!config.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(config.namespace)||
   !/^[a-z0-9][a-z0-9._:-]{2,63}$/i.test(config.consentVersion)||
   !/^\d{6,12}:[A-Za-z0-9_-]{20,}$/.test(config.botToken)||
   !/^[1-9]\d{4,19}$/.test(config.adminChatId))
  throw new Error('review_notifications_require_isolated_auth_and_admin_chat');
 const auth:Guard=guard;
 const pool=new Pool({connectionString:config.databaseUrl,max:2,connectionTimeoutMillis:3000});
 app.addHook('onClose',async()=>pool.end());
 app.post('/api/v3/registration/submit-for-review',
  {preHandler:guard.mutation,bodyLimit:2048},async(request,reply)=>{
   reply.header('Cache-Control','private, no-store');
   const actor=request.authActor;
   if(!actor||reply.sent)return reply.code(401).send({error:'unauthorized'});
   if(!request.body||typeof request.body!=='object'||Array.isArray(request.body)||
      Object.keys(request.body as object).length!==0)
    return reply.code(422).send({error:'invalid_request'});
   const db=await pool.connect().catch(()=>null);
   if(!db)return reply.code(503).send({error:'service_unavailable'});
   try{
    if(!await safeDb(db,'luemi_request'))throw new Error('unsafe_review_role');
    await db.query('BEGIN');
    await db.query("SELECT set_config('luemi.actor_id',$1,true)",[actor.actorId]);
    await db.query("SELECT set_config('luemi.environment',$1,true)",[config.namespace]);
    const active=await db.query(
     "SELECT id FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
     [actor.actorId,config.namespace]);
    if(active.rowCount!==1)throw new Error('inactive_actor');
    const draft=await db.query<{revision:string;consent_version:string|null}>(
     "SELECT revision::text,consent_version FROM luemi_private.private_profile_drafts "+
     "WHERE owner_id=$1 AND environment=$2 FOR UPDATE",
     [actor.actorId,config.namespace]);
    if(draft.rowCount!==1||draft.rows[0].consent_version!==config.consentVersion){
     await db.query('ROLLBACK');
     return reply.code(403).send({error:'consent_or_draft_required'});
    }
    const media=await db.query<{n:string;unready:string}>(
     "SELECT count(*)::text n,count(*) FILTER(WHERE state NOT IN ('pending_review','approved'))::text unready "+
     "FROM luemi_private.media_assets WHERE owner_id=$1 AND environment=$2 AND state<>'revoked'",
     [actor.actorId,config.namespace]);
    const count=Number(media.rows[0]?.n),unready=Number(media.rows[0]?.unready);
    if(count<3||count>6||unready>0){
     await db.query('ROLLBACK');
     return reply.code(409).send({error:'three_to_six_uploaded_photos_required'});
    }
    const revision=Number(draft.rows[0].revision);
    const pending=await db.query<{notified_at:Date|null}>(
     `INSERT INTO luemi_private.profile_review_requests(owner_id,environment,revision,photo_count)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(owner_id) DO UPDATE SET
        revision=EXCLUDED.revision,photo_count=EXCLUDED.photo_count,
        notified_at=CASE WHEN profile_review_requests.revision=EXCLUDED.revision
          AND profile_review_requests.photo_count=EXCLUDED.photo_count
          THEN profile_review_requests.notified_at ELSE NULL END,
        updated_at=clock_timestamp()
      WHERE profile_review_requests.environment=EXCLUDED.environment
      RETURNING notified_at`,
     [actor.actorId,config.namespace,revision,count]);
    if(pending.rowCount!==1)throw new Error('review_conflict');
    if(pending.rows[0].notified_at){
     await auth.read(request,reply);
     if(reply.sent||!request.authActor||request.authActor.sessionId!==actor.sessionId)
      throw new Error('session_revoked');
     await db.query('COMMIT');
     return {state:'review_requested',notified:true,alreadySent:true};
    }
    // Serialize retries under owner row lock; HTTPS is bounded to 8 seconds.
    const notified=await deliverRegistrationReview(config.botToken,config.adminChatId,
      reviewNotificationMessage(actor.actorId,count));
    await auth.read(request,reply);
    if(reply.sent||!request.authActor||
      request.authActor.actorId!==actor.actorId||
      request.authActor.sessionId!==actor.sessionId||
      request.authActor.hash.length!==actor.hash.length||
      !timingSafeEqual(request.authActor.hash,actor.hash))
     throw new Error('session_revoked');
    if(notified){
     await db.query("UPDATE luemi_private.profile_review_requests SET notified_at=clock_timestamp() "+
       "WHERE owner_id=$1 AND environment=$2",[actor.actorId,config.namespace]);
    }
    await db.query('COMMIT');
    return {state:'review_requested',notified,alreadySent:false};
   }catch{
    await db.query('ROLLBACK').catch(()=>undefined);
    if(reply.sent)return reply;
    return reply.code(503).send({error:'review_notification_unavailable'});
   }finally{db.release();}
  });
}
