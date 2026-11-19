import {useEffect,useState} from "react";
import type {CSSProperties} from "react";
import {normalizeCountryCode} from "@luemi/contracts";
import {Globe2} from "lucide-react";

/** HatScripts circle-flags, MIT licensed. The 68 bundled SVGs load offline.
 * Any other ISO two-letter country/territory flag uses the same full
 * 400+ flag collection, fetched on demand from its official GitHub Pages CDN.
 * Fail gracefully if the image is missing or remote assets are blocked.
 * Language flags represent illustrative countries, not language ownership.
 * Never use platform-specific flag emoji.
 */
const hosted=new Set(["am","ru","ge","us","gb","fr","de","es","it","pt","br","tr","jp","kr","cn","in","ir","az","ua","by","kz","uz","kg","tj","tm","md","ro","pl","nl","be","ch","at","gr","il","sa","eg","ma","pk","bd","id","my","th","vn","ph","se","no","dk","fi","cz","sk","hu","rs","hr","bg","lt","lv","ee","is","ie","al","mk","cy","ae","za","et","np"]);
export function Flag({code,size=23,title}:{code?:string;size?:number;title?:string}){
 const raw=(code??"").trim().toLowerCase();
 const country=(normalizeCountryCode(raw)??(raw==="uk"?"gb":raw)).toLowerCase();
 const valid=/^[a-z]{2}$/.test(country);
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[country]);
 const style:CSSProperties={width:size,height:size,flex:"none"};
 const src=hosted.has(country)
  ? "/assets/flags/"+country+".svg"
  : "https://hatscripts.github.io/circle-flags/flags/"+country+".svg";
 return valid&&!broken?
  <img key={country} src={src} width={size} height={size}
   className="round-flag" alt={title??"Флаг "+country.toUpperCase()}
   draggable={false} loading="lazy" decoding="async"
   onError={()=>setBroken(true)} style={style}/>:
  <span className="flag-fallback" style={style} role="img" aria-label={title??"Флаг неизвестен"}>
   <Globe2 size={Math.round(size*.62)} aria-hidden="true"/>
  </span>;
}
