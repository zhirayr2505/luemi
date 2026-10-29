import {normalizeCountryCode} from "@luemi/contracts";
/** Normalized place identity, never infer a valid city from free text. */
export interface GeoPlace {
  id:string;city:string;country:string;countryCode:string;region?:string;
}
const local:GeoPlace[]=[
  {id:"offline:am:yerevan",city:"Ереван",country:"Армения",countryCode:"AM"},
  {id:"offline:am:armavir",city:"Армавир",country:"Армения",countryCode:"AM"},
  {id:"offline:am:gyumri",city:"Гюмри",country:"Армения",countryCode:"AM"},
  {id:"offline:ru:armavir",city:"Армавир",country:"Россия",countryCode:"RU",region:"Краснодарский край"},
  {id:"offline:ru:krasnodar",city:"Краснодар",country:"Россия",countryCode:"RU",region:"Краснодарский край"},
  {id:"offline:ru:moscow",city:"Москва",country:"Россия",countryCode:"RU"},
  {id:"offline:ru:saint-petersburg",city:"Санкт-Петербург",country:"Россия",countryCode:"RU"},
  {id:"offline:ge:tbilisi",city:"Тбилиси",country:"Грузия",countryCode:"GE"},
  {id:"offline:de:frankfurt-am-main",city:"Франкфурт-на-Майне",country:"Германия",countryCode:"DE",region:"Гессен"},
  {id:"offline:de:frankfurt-oder",city:"Франкфурт-на-Одере",country:"Германия",countryCode:"DE",region:"Бранденбург"}
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

/**
 * No-key, first-party coarse reverse lookup for the small set of known cities.
 * This is NOT a worldwide geocoder: return null outside the conservative
 * centre radius; never guess a nearby unrelated town. Exact coordinates are
 * consumed in memory and are never returned or persisted by this function.
 * City centres are reference coordinates, not user's position.
 */
const cityCentres:ReadonlyArray<{id:string;lat:number;lon:number;maxKm:number}>=[
 {id:"offline:ru:krasnodar",lat:45.032778,lon:38.976944,maxKm:22},
 {id:"offline:ru:moscow",lat:55.75393,lon:37.620795,maxKm:18},
 {id:"offline:ru:saint-petersburg",lat:59.939095,lon:30.315868,maxKm:18},
 {id:"offline:am:yerevan",lat:40.1792,lon:44.4991,maxKm:15},
 {id:"offline:am:armavir",lat:40.1545,lon:44.0383,maxKm:12},
 {id:"offline:am:gyumri",lat:40.7894,lon:43.8475,maxKm:13},
 {id:"offline:ge:tbilisi",lat:41.7151,lon:44.8271,maxKm:17}
];
function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number):number{
 const radians=Math.PI/180,dLat=(lat2-lat1)*radians,dLon=(lon2-lon1)*radians;
 const a=Math.sin(dLat/2)**2+
  Math.cos(lat1*radians)*Math.cos(lat2*radians)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export function localReverseCity(lat:number,lon:number):GeoPlace|null{
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 let nearest:{id:string;km:number}|null=null;
 for(const centre of cityCentres){
  const km=distanceKm(lat,lon,centre.lat,centre.lon);
  if(km<=centre.maxKm&&(!nearest||km<nearest.km))nearest={id:centre.id,km};
 }
 const item=nearest?local.find(p=>p.id===nearest.id):null;
 return item?{...item}:null;
}
