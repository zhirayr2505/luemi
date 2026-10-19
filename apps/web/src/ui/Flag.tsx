import type {CSSProperties} from "react";
import {Globe2} from "lucide-react";

/** MIT circle-flags by HatScripts; self-hosted resources for reliable Telegram WebView rendering.
 * Country flags identify *countries*; language flags are explicitly illustrative. */
const hosted = new Set(["am","ru","ge","us","gb","fr","de","es","it","pt","br","tr","jp","kr","cn","in","ir","az","ua","by","kz","uz","kg","tj","tm","md","ro","pl","nl","be","ch","at","gr","il","sa","eg","ma","pk","bd","id","my","th","vn","ph","se","no","dk","fi","cz","sk","hu","rs","hr","bg","lt","lv","ee","is","ie","al","mk","cy","ae","za","et","np"]);
export function Flag({code,size=23,title}:{code?:string;size?:number;title?:string}) {
 const country=(code??"").toLowerCase();
 const style:CSSProperties={width:size,height:size,flex:"none"};
 return /^[a-z]{2}$/.test(country) && hosted.has(country)
   ? <img src={"/assets/flags/"+country+".svg"} width={size} height={size} className="round-flag" alt={title??"Флаг "+country.toUpperCase()} draggable={false} loading="lazy" style={style}/>
   : <span className="flag-fallback" style={style} aria-label={title??"Страна"}><Globe2 size={Math.round(size*.62)} aria-hidden="true"/></span>;
}
