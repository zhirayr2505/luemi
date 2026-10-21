import {normalizeCountryCode} from "@luemi/contracts";
/** Normalized place identity, never infer a valid city from free text. */
export interface GeoPlace {
  id:string;city:string;country:string;countryCode:string;region?:string;
}
const local:GeoPlace[]=[
  {id:"offline:am:yerevan",city:"Ереван",country:"Армения",countryCode:"AM"},
  {id:"offline:am:armavir",city:"Армавир",country:"Армения",countryCode:"AM"},
  {id:"offline:am:gyumri",city:"Гюмри",country:"Армения",countryCode:"AM"},
  {id:"offline:ru:krasnodar",city:"Краснодар",country:"Россия",countryCode:"RU",region:"Краснодарский край"},
  {id:"offline:ru:moscow",city:"Москва",country:"Россия",countryCode:"RU"},
  {id:"offline:ru:saint-petersburg",city:"Санкт-Петербург",country:"Россия",countryCode:"RU"},
  {id:"offline:ge:tbilisi",city:"Тбилиси",country:"Грузия",countryCode:"GE"}
];
const alias=new Map<string,string>([
  ["yerevan","offline:am:yerevan"],["erevan","offline:am:yerevan"],
  ["armenia","offline:am:yerevan"],["armavir","offline:am:armavir"],
  ["gyumri","offline:am:gyumri"],["krasnodar","offline:ru:krasnodar"],
  ["moscow","offline:ru:moscow"],["russia","offline:ru:moscow"],
  ["tbilisi","offline:ge:tbilisi"]
]);
export function localSearch(q:string):GeoPlace[] {
  const text=q.trim().toLocaleLowerCase("ru");
  if(text.length<2)return [];
  const matches=local.filter(x=>[x.city,x.country,x.region??""].some(y=>y.toLocaleLowerCase("ru").includes(text)));
  const target=alias.get(text);
  if(target&&!matches.some(x=>x.id===target))matches.unshift(local.find(x=>x.id===target)!);
  return matches.slice(0,8);
}
export interface GeoapifyProperty {
  place_id?:unknown;city?:unknown;name?:unknown;country?:unknown;
  country_code?:unknown;state?:unknown;result_type?:unknown;
}
export function normalizeGeoapify(input:unknown):GeoPlace[] {
  if(!input||typeof input!=="object"||!("results" in input))return [];
  const results=(input as {results:unknown}).results;
  if(!Array.isArray(results))return [];
  const normalized:GeoPlace[]=[];
  for(const item of results){
    if(!item||typeof item!=="object")continue;
    const x=item as GeoapifyProperty;
    if(x.result_type!=="city"||typeof x.place_id!=="string"||
       typeof x.country_code!=="string"||typeof x.country!=="string")continue;
    const city=typeof x.city==="string"?x.city:typeof x.name==="string"?x.name:"";
    if(!city||!x.place_id||!x.country)continue;
    const code=normalizeCountryCode(x.country_code);
    if(!code)continue;
    normalized.push({id:"geo:"+x.place_id,city,country:x.country,countryCode:code,
      ...(typeof x.state==="string"?{region:x.state}:{})});
  }
  return normalized;
}
