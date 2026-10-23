import type {FastifyInstance} from "fastify";
export interface EmbeddingPolicy {enabled:boolean;ancestors:string[]}
const hashed=/^\/assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|svg|woff2?|png|webp|avif|ico)$/;
export function acceptedAncestors(policy?:EmbeddingPolicy):string[]{
  if(!policy?.enabled)return [];
  if(!Array.isArray(policy.ancestors)||policy.ancestors.length<1||
    policy.ancestors.length>8)throw new Error("REM-05C embedding requires verified exact ancestors");
  const seen=new Set<string>();
  for(const raw of policy.ancestors){
    const parsed=new URL(raw);
    if(parsed.protocol!=="https:"||parsed.username||parsed.password||
      parsed.pathname!=="/"||parsed.search||parsed.hash||
      parsed.origin!==raw||parsed.hostname.includes("*"))throw new Error("Invalid embed ancestor");
    seen.add(raw);
  }
  return [...seen];
}
export function installHttpPolicy(app:FastifyInstance,embedding?:EmbeddingPolicy):void{
  const ancestors=acceptedAncestors(embedding);
  app.addHook("onSend",async(request,reply,payload)=>{
    const path=request.url.split("?")[0];
    const api=path.startsWith("/api/");
    const mime=String(reply.getHeader("content-type")??"").split(";")[0].trim().toLowerCase();
    const html=mime==="text/html";
    const match=hashed.exec(path);
    const immutable=request.method==="GET"&&reply.statusCode===200&&
      match!==null&&!!assetMime[match[1]]?.includes(mime);
    // Never use a URL-shaped fingerprint to classify an HTML SPA fallback.
    const document=!api&&request.method==="GET"&&(html||path==="/"||
      path==="/index.html"||request.headers.accept?.includes("text/html"));
    reply.header("X-Content-Type-Options","nosniff");
    reply.header("Referrer-Policy","no-referrer");
    reply.header("Cross-Origin-Resource-Policy","same-origin");
    reply.header("Cache-Control",api?"private, no-store":immutable?
      "public, max-age=31536000, immutable":document?"no-store":"no-cache");
    if(api){
      reply.header("Vary","Origin, Cookie, Authorization");
      reply.removeHeader("ETag");
      reply.removeHeader("Last-Modified");
    }
    const allowFrame=document&&ancestors.length>0;
    reply.header("Content-Security-Policy",allowFrame?
      "frame-ancestors 'self' "+ancestors.join(" "):"frame-ancestors 'none'");
    if(allowFrame)reply.removeHeader("X-Frame-Options");
    else reply.header("X-Frame-Options","DENY");
    return payload;
  });
}
