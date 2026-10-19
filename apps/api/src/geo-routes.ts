import type {FastifyInstance} from "fastify";
import {localSearch,normalizeGeoapify} from "./geo-data.js";
export function registerGeography(app:FastifyInstance,apiKey=process.env.GEOAPIFY_API_KEY):void {
  app.get<{Querystring:{q?:string}}>("/api/geo/search",async(request,reply)=>{
    const raw=request.query?.q??"";
    if(typeof raw!=="string"||raw.length>80||/[<>]/.test(raw))
      return reply.code(400).send({error:"invalid_query"});
    const q=raw.trim();
    if(q.length<2)return {results:[],coverage:apiKey?"world":"demo"};
    if(!apiKey)return {results:localSearch(q),coverage:"demo"};
    const params=new URLSearchParams({text:q,type:"city",lang:"ru",limit:"8",format:"json",apiKey});
    try {
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),5000);
      try {
        const result=await fetch("https://api.geoapify.com/v1/geocode/autocomplete?"+params,{
          signal:controller.signal,headers:{accept:"application/json"}});
        if(!result.ok)throw new Error("provider error");
        const json=await result.json() as unknown;
        return {results:normalizeGeoapify(json),coverage:"world"};
      } finally {clearTimeout(timer);}
    } catch {
      // Do not misrepresent seven preview entries as a worldwide database.
      return reply.code(503).send({error:"geocoder_unavailable"});
    }
  });

  app.post<{Body:{lat?:number;lon?:number}}>("/api/geo/reverse",async(request,reply)=>{
    const lat=request.body?.lat,lon=request.body?.lon;
    if(typeof lat!=="number"||typeof lon!=="number"||
       !Number.isFinite(lat)||!Number.isFinite(lon)||
       lat < -90||lat > 90||lon < -180||lon > 180)
      return reply.code(400).send({error:"invalid_coordinates"});
    if(!apiKey)return reply.code(503).send({error:"geocoder_unavailable"});
    const params=new URLSearchParams({
      lat:String(lat),lon:String(lon),lang:"ru",format:"json",type:"city",apiKey
    });
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),5000);
    try {
      const response=await fetch("https://api.geoapify.com/v1/geocode/reverse?"+params,
        {signal:controller.signal,headers:{accept:"application/json"}});
      if(!response.ok)throw new Error("provider unavailable");
      const content=await response.json() as {results?:Array<Record<string,unknown>>};
      const first=content.results?.find(x=>typeof x.city==="string"&&typeof x.country==="string"&&
        typeof x.country_code==="string"&&typeof x.place_id==="string");
      if(!first)return reply.code(404).send({error:"city_not_found"});
      const code=String(first.country_code).toUpperCase();
      if(!/^[A-Z]{2}$/.test(code))return reply.code(404).send({error:"city_not_found"});
      return {result:{id:"geo:"+String(first.place_id),city:String(first.city),
        country:String(first.country),countryCode:code,
        ...(typeof first.state==="string"?{region:first.state}:{})}};
    } catch {
      return reply.code(503).send({error:"geocoder_unavailable"});
    } finally {clearTimeout(timer);}
  });
}
