import {useMemo,useState} from "react";
import {BriefcaseBusiness,Check,Heart,Languages,PawPrint,Ruler,Scale,Search,ShieldCheck,Sparkles,X} from "lucide-react";
import type {RegistrationDraft} from "./model";
import {languages,findLanguages} from "../ui/Languages";
import {categories} from "../ui/InterestCatalog";
import "./profile-reveal.css";

type Props={data:RegistrationDraft;change:(change:Partial<RegistrationDraft>)=>void;
 busy:boolean;error:string;onSave:()=>void;onCancel:()=>void};
const lifestyle=["Не курю","Люблю спорт","Люблю путешествия","Ранний подъём","Люблю уютные вечера",
 "Часто выбираюсь на природу","Ночные прогулки","Люблю готовить","Ценю честность",
 "Люблю глубокие разговоры","Открыт(а) новому","Ценю чувство юмора"];
const pets=["Кошки","Собаки","Другие животные"];
const family=["Хочу семью","Уже есть дети","Не планирую детей","Пока не решил(а)"];
const smoking=[["","Не указывать"],["never","Не курю"],["sometimes","Иногда"],["regularly","Курю"],["quitting","Бросаю"]] as const;
const alcohol=[["","Не указывать"],["never","Не пью"],["occasionally","По праздникам"],["sometimes","Иногда"],["regularly","Часто"]] as const;
export function ProfileRevealEditor({data,change,busy,error,onSave,onCancel}:Props){
 const [languageQuery,setLanguageQuery]=useState("");
 const [interestQuery,setInterestQuery]=useState("");
 const [allLanguages,setAllLanguages]=useState(false);
 const availableLanguages=useMemo(()=>findLanguages(languageQuery),[languageQuery]);
 const interestItems=useMemo(()=>categories.flatMap(c=>c.items).filter((item,index,all)=>
   all.findIndex(x=>x.id===item.id)===index&&item.name.toLowerCase().includes(interestQuery.trim().toLowerCase())
  ),[interestQuery]);
 const toggle=(key:"lifestyle"|"pets"|"family"|"languages"|"interests",id:string,max=12)=>{
  const values=data[key];
  change({[key]:values.includes(id)?values.filter(x=>x!==id):values.length<max?[...values,id]:values} as Partial<RegistrationDraft>);
 };
 const choices=(key:"lifestyle"|"pets"|"family",values:string[])=>
  <div className="luemi-reveal-chips">{values.map(value=><button type="button" key={value}
    aria-pressed={data[key].includes(value)} className={"luemi-reveal-chip"+(data[key].includes(value)?" chosen":"")}
    onClick={()=>toggle(key,value)}>{data[key].includes(value)?"✓ ":"＋ "}{value}</button>)}</div>;
 return <section className="luemi-reveal-editor" aria-label="Раскрой себя">
   <header className="luemi-reveal-head">
    <span className="luemi-reveal-eyebrow"><Sparkles size={15}/> ТВОЙ МИР</span>
    <h2>Раскрой себя</h2>
    <p>Расскажи столько, сколько хочешь. Всё необязательно и всё можно изменить.</p>
   </header>
   <div className="luemi-reveal-group">
    <h3><Heart size={17}/> Несколько слов о себе</h3>
    <textarea className="luemi-reveal-control" value={data.about} maxLength={750} rows={4}
      placeholder="Что тебя вдохновляет? Что делает тебя тобой?"
      onChange={e=>change({about:e.target.value})}/>
    <small className="luemi-reveal-counter">{[...data.about].length} / 750</small>
   </div>
   <div className="luemi-reveal-group">
    <h3><Languages size={17}/> Языки общения</h3>
    <div className="luemi-reveal-search"><Search size={16}/><input className="luemi-reveal-control"
      type="search" value={languageQuery} placeholder="Найти язык"
      onChange={e=>setLanguageQuery(e.target.value)}/></div>
    <div className="luemi-reveal-chips">
     {data.languages.map(id=><button type="button" key={id} className="luemi-reveal-chip chosen"
       onClick={()=>toggle("languages",id,10)} aria-label={"Убрать язык "+id}>
       <Check size={13}/>{languages.find(l=>l.id===id)?.name??id}<X size={12}/>
     </button>)}
    </div>
    <div className="luemi-reveal-chips luemi-reveal-language-results">
     {availableLanguages.filter(l=>!data.languages.includes(l.id)).slice(0,(languageQuery||allLanguages)?60:10)
      .map(l=><button type="button" className="luemi-reveal-chip" key={l.id}
        onClick={()=>toggle("languages",l.id,10)}>＋ {l.name}</button>)}
    </div>
    {!languageQuery&&<button className="luemi-reveal-more" type="button"
      onClick={()=>setAllLanguages(!allLanguages)}>
      {allLanguages?"Свернуть":"Все языки"}
    </button>}
    <small>До 10 языков</small>
   </div>
   <div className="luemi-reveal-group">
    <h3><Ruler size={17}/> Внешность</h3>
    <div className="luemi-reveal-columns">
     <label>Рост, см<input className="luemi-reveal-control" type="number" inputMode="numeric"
       min={100} max={250} placeholder="Например, 182" value={data.height??""}
       onChange={e=>change({height:e.target.value?Number(e.target.value):null})}/></label>
     <label><Scale size={14}/> Вес, кг<input className="luemi-reveal-control" type="number" inputMode="numeric"
       min={35} max={300} placeholder="По желанию" value={data.weight??""}
       onChange={e=>change({weight:e.target.value?Number(e.target.value):null})}/></label>
    </div>
   </div>
   <div className="luemi-reveal-group">
    <h3><BriefcaseBusiness size={17}/> Чем занимаешься</h3>
    <label>Работа или дело жизни<input className="luemi-reveal-control" maxLength={120}
      placeholder="Например, дизайнер" value={data.occupation}
      onChange={e=>change({occupation:e.target.value})}/></label>
    <label>Образование<input className="luemi-reveal-control" maxLength={120}
      placeholder="По желанию" value={data.education}
      onChange={e=>change({education:e.target.value})}/></label>
   </div>
   <div className="luemi-reveal-group">
    <h3><Sparkles size={17}/> Привычки</h3>
    <label>Курение<select className="luemi-reveal-control" value={data.smoking} onChange={e=>change({smoking:e.target.value})}>
     {smoking.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Алкоголь<select className="luemi-reveal-control" value={data.alcohol} onChange={e=>change({alcohol:e.target.value})}>
     {alcohol.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
    <h4>Образ жизни</h4>{choices("lifestyle",lifestyle)}
   </div>
   <div className="luemi-reveal-group"><h3><PawPrint size={17}/> Домашние животные</h3>
    {choices("pets",pets)}</div>
   <div className="luemi-reveal-group"><h3><Heart size={17}/> Семья и планы</h3>
    {choices("family",family)}</div>
   <div className="luemi-reveal-group">
    <h3><Sparkles size={17}/> Интересы</h3>
    <div className="luemi-reveal-search"><Search size={16}/><input className="luemi-reveal-control" type="search"
     placeholder="Найти интерес" value={interestQuery} onChange={e=>setInterestQuery(e.target.value)}/></div>
    <div className="luemi-reveal-chips">{interestItems.slice(0,interestQuery?50:36).map(item=>
      <button key={item.id} type="button" className={"luemi-reveal-chip"+(data.interests.includes(item.id)?" chosen":"")}
       aria-pressed={data.interests.includes(item.id)} onClick={()=>toggle("interests",item.id,20)}>
       {data.interests.includes(item.id)?"✓ ":"＋ "}{item.name}
      </button>)}</div>
    <small>{data.interests.length} из 20 выбрано</small>
   </div>
   <div className="luemi-reveal-group">
    <h3><Sparkles size={17}/> Три факта о тебе</h3>
    <textarea className="luemi-reveal-control" rows={3} maxLength={240}
      placeholder={"Умею готовить хачапури\nЛюблю рассветы"}
      value={data.facts.join("\n")}
      onChange={e=>change({facts:e.target.value.split("\n").slice(0,3)})}/>
   </div>
   <p className="luemi-reveal-privacy"><ShieldCheck size={17}/> Текст «О себе», языки и интересы видят другие. Остальные детали сохраняются приватно — ты сможешь управлять их видимостью позже.</p>
   {error&&<p role="alert" className="luemi-reveal-error">{error}</p>}
   <div className="luemi-reveal-actions">
    <button type="button" disabled={busy} onClick={onCancel}>Отмена</button>
    <button type="button" disabled={busy} onClick={onSave}>
     {busy?"Сохраняем…":<><Check size={17}/> Сохранить</>}
    </button>
   </div>
 </section>;
}
