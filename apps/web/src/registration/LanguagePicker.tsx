import {useMemo,useRef,useState} from "react";
import {Search,Check} from "lucide-react";
import {Flag} from "../ui/Flag";
import {languages,findLanguages} from "../ui/Languages";
import {FOCUS_RELEASE_DELAY_MS,useFieldFocusDock} from "./use-field-focus";
export function LanguagePicker({selected,onChange,onFocusChange}:{selected:string[];onChange:(value:string[])=>void;onFocusChange?:(focused:boolean)=>void}){
 const [query,setQuery]=useState("");
 const [focused,setFocused]=useState(false);
 const inputRef=useRef<HTMLInputElement>(null);
 const resultsRef=useRef<HTMLDivElement>(null);
 const dock=useFieldFocusDock(focused);
 const filtered=useMemo(()=>findLanguages(query),[query]);
 const toggle=(id:string)=>onChange(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]);
 return <div className="language-picker">
   <div className="focus-field-slot language-focus-slot"><div ref={node=>{dock.shellRef.current=node;}}
    className={"focus-field-shell language-focus-shell"+(focused?" is-focused":"")}>
   <div className="field-label">Языки общения</div>
   <label className="geo-input-wrap">
     <Search size={18} aria-hidden="true"/>
     <input ref={inputRef} className="glass-control geo-input" type="search" placeholder="Найди язык из 60" value={query}
       onFocus={()=>{setFocused(true);onFocusChange?.(true);}}
       onBlur={()=>window.setTimeout(()=>{setFocused(false);onFocusChange?.(false);},FOCUS_RELEASE_DELAY_MS)}
       onChange={e=>{
         setQuery(e.target.value);
         // A new query starts from the first matching suggestion, not an old scroll offset.
         if(resultsRef.current)resultsRef.current.scrollTop=0;
       }}/>
   </label>
   {selected.length>0&&<div className="language-selected">
     {selected.map(id=>{const data=languages.find(x=>x.id===id);return data?<button type="button" key={id}
       aria-label={"Убрать язык: "+data.name} title={data.name} onClick={()=>toggle(id)} className="language-flag-selected">
       <Flag code={data.flag} size={27} title={data.name}/>
     </button>:null})}
   </div>}
   <div className="language-results-status" role="status" aria-live="polite">
      {query.trim()?`Найдено: ${filtered.length}`:`${languages.length} языков · листай вниз`}
    </div>
    <div ref={resultsRef} className="language-results" role="group"
      aria-label={query.trim()?"Подходящие языки":"Все языки общения"} tabIndex={-1}>
     {filtered.length===0&&<p className="hint">Нет совпадений. Попробуй другое название.</p>}
     {filtered.map(item=><button key={item.id} type="button" className={"language-option"+(selected.includes(item.id)?" selected":"")} aria-pressed={selected.includes(item.id)} onClick={()=>toggle(item.id)} title={item.name}>
       <Flag code={item.flag} size={24} title={"Иллюстративный флаг "+item.name}/>
       <span>{item.name}</span>{selected.includes(item.id)&&<Check size={15} aria-hidden="true"/>}
     </button>)}
   </div>
   <p className="hint">Флаги — иллюстрация, а не утверждение, что на языке говорят только в одной стране.</p>
   </div></div>
 </div>;
}
