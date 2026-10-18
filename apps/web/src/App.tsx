import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { adult, validInterestCount, validName, validPhotoCount } from "./validation";

type Tab = "discover" | "likes" | "chats" | "profile";
type Theme = "light" | "dark";
const interests = ["Музыка", "Путешествия", "Кино", "Кофе", "Книги", "Спорт", "Искусство", "Прогулки", "Готовка", "Технологии", "Животные", "Танцы", "Природа", "Игры", "Фотография"];
const stepNames = ["Как тебя зовут?", "Дата рождения и пол", "Где ты живёшь?", "Кого ищешь?", "Что тебе нравится?", "Расскажи о себе", "Твои фотографии", "Твоя анкета"];
const tabs: {id:Tab;name:string;icon:string}[] = [
  {id:"discover",name:"Знакомства",icon:"tab-discover"}, {id:"likes",name:"Симпатии",icon:"tab-likes"},
  {id:"chats",name:"Чаты",icon:"tab-chats"}, {id:"profile",name:"Профиль",icon:"tab-profile"},
];

function GlassButton({children,onClick,kind="soft",disabled=false}:{children:ReactNode;onClick:()=>void;kind?:"soft"|"primary"|"plain";disabled?:boolean}) {
  return <button className={`glass-button ${kind}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
function Brand({compact=false}:{compact?:boolean}) {
  return <div className={compact?"brand-island":"brand-banner"} aria-label="luemi">
    <img src="/assets/brand/wordmark_original_raster_alpha_W06.webp" alt="luemi" onError={e=>{e.currentTarget.style.display="none";e.currentTarget.nextElementSibling?.classList.remove("fallback-hidden");}} />
    <span className="brand-fallback fallback-hidden">luemi</span>
  </div>;
}
type Draft = { name:string; birthday:string; gender:string; city:string; country:string; seeking:string; purpose:string; about:string; language:string; selected:string[]; photos:string[] };
const init:Draft = {name:"",birthday:"",gender:"",city:"",country:"",seeking:"Все",purpose:"Отношения",about:"",language:"Русский",selected:[],photos:[]};

export default function App() {
  const [theme,setTheme] = useState<Theme>("light");
  const [phase,setPhase] = useState<"welcome"|"onboarding"|"app">("welcome");
  const [step,setStep] = useState(0);
  const [draft,setDraft] = useState<Draft>(init);
  const [error,setError] = useState("");
  const [tab,setTab] = useState<Tab>("discover");
  const [sub,setSub] = useState("Лента");
  const [likes,setLikes] = useState(0);
  const [chatOpen,setChatOpen] = useState(false);
  const [messages,setMessages] = useState([{text:"Привет! 💜",mine:false},{text:"Это демонстрация переписки LUEMI.",mine:false}]);
  const [message,setMessage] = useState("");
  const [enabledDemo,setEnabledDemo] = useState(false);
  const photoObjectUrls = useRef(new Set<string>());

  useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.lang="ru";},[theme]);
  useEffect(()=>()=>{for (const url of photoObjectUrls.current) URL.revokeObjectURL(url);},[]);

  const patch=(fields:Partial<Draft>)=>{setDraft(previous=>({...previous,...fields}));setError("");};
  const validate=():string=>{
    switch(step){
      case 0: return validName(draft.name)?"":"Имя: от 2 до 40 букв, можно дефис и апостроф";
      case 1: return adult(draft.birthday)&&!!draft.gender?"":"Укажи настоящую дату рождения (18+) и пол";
      case 2: return draft.country.trim()&&draft.city.trim()?"":"Укажи страну и город";
      case 3: return draft.seeking&&draft.purpose?"":"Выбери предпочтения";
      case 4: return validInterestCount(draft.selected.length)?"":"Выбери от 1 до 15 интересов";
      case 6: return validPhotoCount(draft.photos.length)?"":"Для регистрации нужно от 3 до 6 фото";
      default: return "";
    }
  };
  const next=()=>{const issue=validate();if(issue){setError(issue);return;} if(step===7){setEnabledDemo(true);setPhase("app");return;}setStep(v=>v+1);setError("");};
  const choosePhotos=(event:ChangeEvent<HTMLInputElement>)=>{
    const inputFiles=Array.from(event.target.files??[]).filter(f=>["image/jpeg","image/png","image/webp"].includes(f.type));
    const slots=Math.max(0,6-draft.photos.length);
    if(inputFiles.length>slots) setError("Максимум 6 фотографий");
    else setError("");
    const urls=inputFiles.slice(0,slots).map(f=>URL.createObjectURL(f));
    urls.forEach(url=>photoObjectUrls.current.add(url));
    patch({photos:[...draft.photos,...urls]});
    event.target.value="";
  };
  const send=()=>{const clean=message.trim();if(clean){setMessages(prev=>[...prev,{text:clean,mine:true}]);setMessage("");}};
  const onBack=()=>{
    if(chatOpen){setChatOpen(false);return;}
    if(phase==="onboarding"){if(step===0)setPhase("welcome");else setStep(s=>s-1);}
  };
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{if(event.key==="Escape")onBack();};
    document.addEventListener("keydown",handler);return()=>document.removeEventListener("keydown",handler);
  },[chatOpen,phase,step]);

  return <div className="viewport">
    <main className="phone">
      {phase==="welcome" ? <section className="welcome screen">
        <div className="welcome-orbit">✦</div>
        <Brand />
        <h1>Твоя история начинается здесь</h1>
        <p>Люди, с которыми хочется быть собой.</p>
        <div className="welcome-actions">
          <GlassButton kind="primary" onClick={()=>setPhase("onboarding")}>Начать знакомство <span>→</span></GlassButton>
          <GlassButton onClick={()=>{setEnabledDemo(true);setPhase("app");}}>Посмотреть демо</GlassButton>
          <span className="small">18+ · Демо без публикации анкеты</span>
        </div>
      </section> : null}

      {phase==="onboarding" ? <section className="onboard screen" key={step}>
        <Brand /><div className="progress" aria-label={`Шаг ${step+1} из 8`}><span style={{width:`${(step+1)*12.5}%`}}/></div>
        <h1>{stepNames[step]}</h1>
        <p className="subline">{step===6?"Добавь от 3 до 6 фото, чтобы тебя легче было узнать.":step===7?"Так твоя анкета будет выглядеть для других.":"Создадим анкету в твоём ритме."}</p>
        <div className="form-body">
          {step===0 && <label className="field-label">Имя<input value={draft.name} maxLength={40} placeholder="Например, Алина" onChange={e=>patch({name:e.target.value})}/></label>}
          {step===1 && <><label className="field-label">Дата рождения<input value={draft.birthday} inputMode="numeric" placeholder="ДД.ММ.ГГГГ" onChange={e=>patch({birthday:e.target.value})}/></label><div className="choices">{["Женщина","Мужчина"].map(g=><button key={g} className={draft.gender===g?"choice chosen":"choice"} onClick={()=>patch({gender:g})}>{g}</button>)}</div></>}
          {step===2 && <><label className="field-label">Страна<input value={draft.country} placeholder="Страна" onChange={e=>patch({country:e.target.value})}/></label><label className="field-label">Город<input value={draft.city} placeholder="Город" onChange={e=>patch({city:e.target.value})}/></label><div className="hint">Точные координаты другим пользователям не показываются.</div></>}
          {step===3 && <><div className="field-label">Кого хочешь встретить?</div><div className="choices">{["Мужчин","Женщин","Все"].map(x=><button key={x} onClick={()=>patch({seeking:x})} className={draft.seeking===x?"choice chosen":"choice"}>{x}</button>)}</div><div className="field-label">Цель знакомства</div><div className="choices">{["Отношения","Свидания","Общение","Не определился"].map(x=><button key={x} onClick={()=>patch({purpose:x})} className={draft.purpose===x?"choice chosen":"choice"}>{x}</button>)}</div></>}
          {step===4 && <><p className="hint">Выбрано {draft.selected.length} из 15</p><div className="interest-grid">{interests.map(interest=><button key={interest} className={draft.selected.includes(interest)?"interest selected":"interest"} onClick={()=>patch({selected:draft.selected.includes(interest)?draft.selected.filter(x=>x!==interest):draft.selected.length===15?draft.selected:[...draft.selected,interest]})}>{interest}</button>)}</div></>}
          {step===5 && <><label className="field-label">О себе<textarea maxLength={250} value={draft.about} rows={5} placeholder="Чем ты увлекаешься? Что тебя радует?" onChange={e=>patch({about:e.target.value})}/><span className="counter">{draft.about.length}/250</span></label><label className="field-label">Язык<select value={draft.language} onChange={e=>patch({language:e.target.value})}><option>Русский</option><option>English</option><option>Հայերեն</option></select></label></>}
          {step===6 && <><div className="photo-grid">{draft.photos.map((src,i)=><div className={i===0?"photo-tile big":"photo-tile"} key={src}><img src={src} alt={`Выбранное фото ${i+1}`}/><button className="remove-photo" aria-label="Удалить фото" onClick={()=>{URL.revokeObjectURL(src);photoObjectUrls.current.delete(src);patch({photos:draft.photos.filter(url=>url!==src)});}}>×</button>{i===0&&<span className="main-photo">★ Главное фото</span>}</div>)}{draft.photos.length<6&&<label className="photo-add">＋<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={choosePhotos}/></label>}</div><p className="hint">Добавлено {draft.photos.length} из 6. Перед публикацией — проверка фотографий.</p></>}
          {step===7&&<div className="preview glass-surface"><div className="preview-photo">{draft.photos[0]&&<img src={draft.photos[0]} alt="Главное фото"/>}</div><div className="preview-info"><h2>{draft.name}</h2><span>{draft.city}, {draft.country}</span><p>{draft.about||"История начнётся с первой встречи."}</p><div className="chips">{draft.selected.slice(0,4).map(x=><span key={x}>{x}</span>)}</div></div></div>}
          {error&&<div role="alert" className="form-error">{error}</div>}
        </div>
        <div className="step-controls"><button className="round-back" onClick={onBack} aria-label="Назад">‹</button><span className="step-caption">Шаг {step+1} из 8</span><button className="round-next" onClick={next} aria-label="Далее">{step===7?"✓":"›"}</button></div>
      </section>:null}

      {phase==="app" && <section className="app-screen screen">
        {chatOpen ? <div className="chat-full">
          <header className="chat-header"><button className="small-round" onClick={()=>setChatOpen(false)} aria-label="К списку чатов">‹</button><Brand compact/><button className="small-round" aria-label="Меню" onClick={()=>{}}>···</button></header>
          <div className="chat-partner"><div className="avatar">А</div><div><strong>Алина <span className="verified">✦</span></strong><small>Демо-переписка</small></div></div>
          <div className="chat-scroll"><div className="system-message">Сегодня · Демонстрация</div>{messages.map((m,i)=><div key={i} className={m.mine?"bubble mine":"bubble"}>{m.text}</div>)}</div>
          <form className="composer" onSubmit={e=>{e.preventDefault();send();}}><input aria-label="Сообщение" placeholder="Сообщение" value={message} onChange={e=>setMessage(e.target.value)} maxLength={2000}/><button type="submit" aria-label="Отправить" disabled={!message.trim()}>➤</button></form>
        </div>:<>
          <header className="app-header"><button className="small-round" onClick={()=>setTab("chats")} aria-label="Чаты">♧</button><Brand compact/><button className="small-round" onClick={()=>setTheme(t=>t==="light"?"dark":"light")} aria-label="Переключить тему">☷</button></header>
          <div className="app-content" key={tab}>
            {tab==="discover"&&<><div className="segment">{["Лента","Для тебя","Рядом"].map(x=><button className={sub===x?"segment-active":""} key={x} onClick={()=>setSub(x)}>{x}</button>)}</div><div className="filterline"><span>⌖ {draft.city||"Краснодар"} ▾</span><button onClick={()=>setSub("Для тебя")}>Фильтры ⚊</button></div><div className="profile-card"><div className="demo-portrait"><span className="demo-caption">Демо-профиль · синтетические данные</span></div><div className="card-details"><h2>Алина, 26 <span>✦</span></h2><p>🇷🇺 Краснодар · серьёзные отношения</p><div className="chips"><span>Кофе</span><span>Путешествия</span><span>+3</span></div><small>Люблю море, книги и долгие разговоры...</small></div></div><div className="actions"><button onClick={()=>setSub("Для тебя")} aria-label="Сохранить"><img src={`/assets/icons/core/${theme}/action-save.svg`} alt=""/><small>Сохранить</small></button><button onClick={()=>setSub("Рядом")} aria-label="Пропустить"><img src={`/assets/icons/core/${theme}/action-skip.svg`} alt=""/><small>Пропустить</small></button><button className="special" onClick={()=>setLikes(n=>n+1)} aria-label="Особенная"><img src={`/assets/icons/core/${theme}/action-special.svg`} alt=""/><small>Особенная</small></button><button className="heart" onClick={()=>setLikes(n=>n+1)} aria-label="Нравится"><img src={`/assets/icons/core/${theme}/action-like.svg`} alt=""/><small>Нравится</small></button><button onClick={()=>setLikes(n=>Math.max(0,n-1))} aria-label="Отменить"><img src={`/assets/icons/core/${theme}/action-undo.svg`} alt=""/><small>Отменить</small></button></div></>}
            {tab==="likes"&&<><h1>Симпатии</h1><div className="segment"><button className="segment-active">Мэтчи</button><button onClick={()=>{}}>Входящие</button></div><div className="empty glass-surface"><span>♡</span><h2>{likes?"Тебе понравилась Алина":"Здесь появятся мэтчи"}</h2><p>Когда симпатия окажется взаимной, здесь начнётся ваша история. Демонстрационный лайк не отправляется.</p></div></>}
            {tab==="chats"&&<><h1>Чаты</h1><div className="segment"><button className="segment-active">Все</button><button>Непрочитанные</button></div><button className="chat-entry glass-surface" onClick={()=>setChatOpen(true)}><div className="avatar">А</div><div><strong>Алина <span>✦</span></strong><p>Открыть демонстрационную переписку</p></div><span>›</span></button><div className="hint">Сообщения хранятся только в памяти этой вкладки.</div></>}
            {tab==="profile"&&<><h1>Профиль</h1><div className="own-profile glass-surface"><div className="avatar self">{draft.name?draft.name[0]:"Л"}</div><h2>{draft.name||"Гость LUEMI"}</h2><p>{draft.city||"Демо-профиль"} · Не опубликован</p></div><div className="setting glass-surface"><span>Оформление</span><button onClick={()=>setTheme(t=>t==="light"?"dark":"light")}>{theme==="light"?"☾ Тёмная":"☀ Светлая"}</button></div><div className="setting glass-surface"><span>Premium / LUME</span><span>Скоро · оплаты нет</span></div><GlassButton onClick={()=>{setChatOpen(false);setTab("discover");setPhase("welcome");}}>Вернуться к началу</GlassButton></>}
          </div>
          <nav className="bottom-nav" aria-label="Основные разделы">{tabs.map(item=><button key={item.id} className={tab===item.id?"nav-active":""} aria-current={tab===item.id?"page":undefined} onClick={()=>setTab(item.id)}><img src={`/assets/icons/core/${theme}/${item.icon}.svg`} alt="" width="24" height="24"/><small>{item.name}</small></button>)}</nav>
          {enabledDemo&&<div className="demo-chip">ДЕМО · данные не отправляются</div>}
        </>}
      </section>}
    </main>
  </div>;
}
