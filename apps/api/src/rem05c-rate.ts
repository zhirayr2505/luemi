import type {FastifyReply,FastifyRequest} from "fastify";
/** Route-scoped, process-local emergency abuse protection.
 * Never claims distributed network fairness (Render proxy topology unknown).
 * Authenticated geo spending is separately enforced by shared PostgreSQL.
 */
export class RateBuckets {
 private readonly buckets=new Map<string,{count:number;expires:number}>();
 check(key:string,limit:number,windowMs=60000):{allowed:boolean;retryAfter:number}{
  const now=Date.now();
  const b=this.buckets.get(key);
  if(!b||b.expires<=now){
   if(this.buckets.size>10000){
    for(const [k,v] of this.buckets){if(v.expires<=now)this.buckets.delete(k);}
    if(this.buckets.size>20000)this.buckets.clear(); // fail-safe ceiling below still applies per operation
   }
   this.buckets.set(key,{count:1,expires:now+windowMs});
   return{allowed:true,retryAfter:0};
  }
  if(b.count>=limit)return{allowed:false,retryAfter:Math.max(1,Math.ceil((b.expires-now)/1000))};
  b.count++;
  return{allowed:true,retryAfter:0};
 }
}
/** Independent network and process-wide buckets. The global guard limits
 * unbounded identity attempts across rotating peers on THIS Node only. */
export function installNetworkLimits(
  onRequest:(hook:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>)=>void
):void{
 const peer=new RateBuckets(),processWide=new RateBuckets();
 onRequest(async(req,reply)=>{
  const path=req.url.split("?")[0];
  const key=path==="/api/auth/telegram"||path==="/api/v2/auth/telegram"?"auth":
    path==="/api/telegram/webhook"?"webhook":
    path==="/api/health/ready"?"ready":null;
  if(!key)return;
  const perPeer=key==="auth"?80:key==="webhook"?120:30;
  const wholeProcess=key==="auth"?400:key==="webhook"?2400:1200;
  // request.ip is socket peer because Fastify trustProxy=false. Ignore user XFF.
  const limit=peer.check(key+":"+req.ip,perPeer);
  const ceiling=processWide.check(key,wholeProcess);
  if(!limit.allowed||!ceiling.allowed){
   reply.header("Retry-After",String(Math.max(limit.retryAfter,ceiling.retryAfter,1)));
   reply.code(429).send({error:"rate_limited"});
  }
 });
}
