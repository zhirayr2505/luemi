import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import {normalizeCountryCode} from "@luemi/contracts";
import {localSearch,normalizeGeoapify} from "./geo-data.js";
import {GeoBudget} from "./rem05c-quota.js";
import type {GeoBudgetConfig,GeoOperation} from "./rem05c-quota.js";

export interface GeoRuntime {
  enabled:boolean;
  providerEnabled:boolean;
  providerKey:string;
  budget?:GeoBudgetConfig;
  /** Test seam: synthetic fake upstream. No user-selected URLs or hosts. */
  providerFetch?:typeof fetch;
}
export interface SessionGuards {
  read:(request:FastifyRequest,reply:FastifyReply)=>Promise<void>;
  mutation:(request:FastifyRequest,reply:FastifyReply)=>Promise<void>;
}
type SearchQuery={q?:unknown};
type ReverseBody={lat?:unknown;lon?:unknown};
function query(value:unknown):string|null{
  if(typeof value!=="string")return null;
  const trimmed=value.trim().normalize("NFC");
  if([...trimmed].length<2||[...trimmed].length>80||/[\u0000-\u001f\u007f<>]/u.test(trimmed))return null;
  return trimmed;
}
function coordinates(body:unknown):{lat:number;lon:number}|null{
  if(!body||typeof body!=="object")return null;
  const {lat,lon}=body as ReverseBody;
  return typeof lat==="number"&&typeof lon==="number"&&
    Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180
    ?{lat,lon}:null;
}
async function upstream(op:GeoOperation,key:string,input:string|{lat:number;lon:number},
  fetcher:typeof fetch){
  const params=op==="search"?
    new URLSearchParams({text:input as string,type:"city",lang:"ru",limit:"8",format:"json",apiKey:key}):
    new URLSearchParams({lat:String((input as {lat:number}).lat),lon:String((input as {lon:number}).lon),
      lang:"ru",format:"json",type:"city",apiKey:key});
  const endpoint=op==="search"?"autocomplete":"reverse";
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetcher("https://api.geoapify.com/v1/geocode/"+endpoint+"?"+params,{
      signal:controller.signal,headers:{accept:"application/json"}});
    if(response.status===429)return{error:"quota",status:429 as const};
    if(!response.ok)return{error:"unavailable",status:503 as const};
    const raw:unknown=await response.json();
    if(!raw||typeof raw!=="object"||!Array.isArray((raw as {results?:unknown}).results))
      return{error:"unavailable",status:503 as const};
    return{raw,status:200 as const};
  }catch{return{error:"unavailable",status:503 as const};}
  finally{clearTimeout(timer);}
}
/** Legacy is guaranteed fixture-only, even when a real environment contains a
 * GEOAPIFY_API_KEY. Only v2 + checked actor + opt-in durable budget may charge. */
export function registerGeography(app:FastifyInstance,runtime?:GeoRuntime,guards?:SessionGuards):void{
  app.get<{Querystring:SearchQuery}>("/api/geo/search",async(request,reply)=>{
    const q=query(request.query?.q);
    if(q===null){
      if(request.query?.q===""||String(request.query?.q??"").trim().length<2)
        return{results:[],coverage:"demo"};
      return reply.code(400).send({error:"invalid_query"});
    }
    return{results:localSearch(q),coverage:"demo"};
  });
  app.post("/api/geo/reverse",async(_request,reply)=>
    reply.code(503).send({error:"geocoder_unavailable"}));
  const available=!!runtime?.enabled&&!!guards;
  const authorizedRead=guards?.read;
  const authorizedMutation=guards?.mutation;
  // Explicit v2 is unavailable when REM05B sessions or REM05C gate is disabled.
  // This is independent of the legacy safe offline fixture endpoint.
  const v2Read=async(req:FastifyRequest,reply:FastifyReply)=>{
    if(!available)return reply.code(503).send({error:"service_unavailable"});
    await authorizedRead!(req,reply);
  };
  const v2Mutation=async(req:FastifyRequest,reply:FastifyReply)=>{
    if(!available)return reply.code(503).send({error:"service_unavailable"});
    await authorizedMutation!(req,reply);
  };
  const providerEnabled=available&&runtime?.providerEnabled===true;
  if(providerEnabled&&(!runtime?.providerKey||!runtime.budget))
    throw new Error("REM-05C charged geo requires key and durable budget");
  const budget=providerEnabled?new GeoBudget(runtime!.budget!):undefined;
  if(budget)app.addHook("onClose",()=>budget.close());
  async function execute(op:GeoOperation,actor:string,input:string|{lat:number;lon:number},
    reply:FastifyReply){
    if(!providerEnabled||!budget)return reply.code(503).send({error:"geocoder_unavailable"});
    const reserve=await budget.reserve(actor,op);
    if(!reserve.ok){
      reply.header("Retry-After",String(reserve.retryAfter));
      return reply.code(reserve.reason==="quota"?429:503).send({
        error:reserve.reason==="quota"?"geo_quota_exceeded":"geocoder_unavailable"});
    }
    try{
      const response=await upstream(op,runtime!.providerKey,input,runtime!.providerFetch??fetch);
      if(response.status!==200){
        if(response.status===429)reply.header("Retry-After","30");
        return reply.code(response.status).send({
          error:response.status===429?"provider_rate_limited":"geocoder_unavailable"});
      }
      if(op==="search")return{results:normalizeGeoapify(response.raw),coverage:"world"};
      const items=(response.raw as {results:Record<string,unknown>[]}).results;
      const first=items.find(x=>typeof x.city==="string"&&typeof x.country==="string"&&
        typeof x.country_code==="string"&&typeof x.place_id==="string");
      const countryCode=first?normalizeCountryCode(first.country_code):null;
      if(!first||!countryCode)return reply.code(404).send({error:"city_not_found"});
      return{result:{id:"geo:"+first.place_id,city:first.city,
        country:first.country,countryCode,
        ...(typeof first.state==="string"?{region:first.state}:{})}};
    }finally{await reserve.release();}
  }
  app.get<{Querystring:SearchQuery}>("/api/v2/geo/search",{preHandler:v2Read},async(request,reply)=>{
    const q=query(request.query?.q);
    if(q===null)return reply.code(400).send({error:"invalid_query"});
    if(!providerEnabled)return{results:localSearch(q),coverage:"demo"};
    return execute("search",request.authActor!.actorId,q,reply);
  });
  app.post<{Body:ReverseBody}>("/api/v2/geo/reverse",{preHandler:v2Mutation,
    bodyLimit:1024},async(request,reply)=>{
    if(!String(request.headers["content-type"]??"").startsWith("application/json"))
      return reply.code(400).send({error:"invalid_content_type"});
    const loc=coordinates(request.body);
    if(!loc)return reply.code(400).send({error:"invalid_coordinates"});
    return execute("reverse",request.authActor!.actorId,loc,reply);
  });
}
