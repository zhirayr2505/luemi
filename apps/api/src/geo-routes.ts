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
}
