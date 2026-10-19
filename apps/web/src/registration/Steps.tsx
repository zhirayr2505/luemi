import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { birthDateValid, type RegistrationDraft } from "./model";

export interface PhotoItem { id: string; src: string; file: File }
export interface StepProps {
  data: RegistrationDraft;
  patch: (change: Partial<RegistrationDraft>) => void;
  photos: PhotoItem[];
  addPhotos: (files: FileList | null) => void;
  removePhoto: (id: string) => void;
  movePhoto: (from: number, to: number) => void;
  editStep: (step: number) => void;
  step: number;
}

const interestCategories = [
  { name: "Популярное", items: ["Музыка", "Путешествия", "Кино", "Кулинария", "Спорт", "Книги"] },
  { name: "Творчество", items: ["Фотография", "Рисование", "Танцы", "Дизайн", "Театр"] },
  { name: "Активность", items: ["Прогулки", "Походы", "Фитнес", "Йога", "Плавание"] },
  { name: "Досуг", items: ["Кофе", "Игры", "Природа", "Животные", "Языки"] }
];
const languages = ["Русский", "English", "Հայերեն"];

function Field({label,children}:{label:string;children:ReactNode}) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
function Choice({chosen, children, onClick}:{chosen:boolean; children:ReactNode;onClick:()=>void}) {
  return <button className={"choice"+(chosen?" selected":"")} type="button" aria-pressed={chosen} onClick={onClick}>{children}</button>;
}
function ProfilePreview({data,photos}:{data:RegistrationDraft;photos:PhotoItem[]}) {
  const [active,setActive] = useState(0);
  const imageIndex=Math.min(active, Math.max(0,photos.length-1));
  return <div className="profile-preview">
    <div className="profile-photo">
      {photos.length>0
        ? <img src={photos[imageIndex].src} alt="Фотография в предварительном просмотре" />
        : <div className="profile-placeholder">Здесь появится твоя фотография</div>}
      {photos.length>1&&<div className="photo-progress">{photos.map((p,i)=><button key={p.id} type="button" aria-label={"Фото "+(i+1)} className={i===imageIndex?"current":""} onClick={()=>setActive(i)}/>)}</div>}
      <div className="profile-name">{data.name||"Твоё имя"}{birthDateValid(data.day,data.month,data.year)?<span>, {ageOf(data)}</span>:null}</div>
    </div>
    <div className="profile-details">
      <p className="profile-location">{[data.city,data.country].filter(Boolean).join(" · ")}</p>
      {data.goal&&<p>{({relationship:"Отношения",dates:"Свидания",friends:"Общение"} as const)[data.goal]}</p>}
      {data.about&&<p>{data.about}</p>}
      {data.interests.length>0&&<div className="chips">{data.interests.map(item=><span className="chip" key={item}>{item}</span>)}</div>}
      {data.languages.length>0&&<p>Языки: {data.languages.join(", ")}</p>}
    </div>
  </div>;
}
function ageOf(d:RegistrationDraft):number {
  const today=new Date();let age=today.getFullYear()-Number(d.year);
  const notYet=today.getMonth()+1<Number(d.month)||(today.getMonth()+1===Number(d.month)&&today.getDate()<Number(d.day));
  return age-(notYet?1:0);
}
export function RegistrationStep({data,patch,photos,addPhotos,removePhoto,movePhoto,editStep,step}:StepProps) {
  const fileRef=useRef<HTMLInputElement>(null);
  const monthRef=useRef<HTMLInputElement>(null);
  const yearRef=useRef<HTMLInputElement>(null);
  const [category,setCategory]=useState("Популярное");
  const [dragIndex,setDragIndex]=useState<number|null>(null);
  const pickPhoto=()=>fileRef.current?.click();
  const dateInput=(part:"day"|"month"|"year",val:string)=>{
    const next=val.replace(/\D/g,"").slice(0,part==="year"?4:2);
    patch({[part]:next});
    if(part==="day"&&next.length===2)monthRef.current?.focus();
    if(part==="month"&&next.length===2)yearRef.current?.focus();
    if(part==="year"&&next.length===4)yearRef.current?.blur();
  };
  const toggleInterest=(item:string)=>{
    patch({interests:data.interests.includes(item)
      ? data.interests.filter(x=>x!==item)
      : data.interests.length<15?[...data.interests,item]:data.interests});
  };
  const onFiles=(event:ChangeEvent<HTMLInputElement>)=>{
    addPhotos(event.target.files);
    event.target.value="";
  };
  const drop=(event:DragEvent<HTMLDivElement>,index:number)=>{
    event.preventDefault();
    if(dragIndex!==null&&dragIndex!==index)movePhoto(dragIndex,index);
    setDragIndex(null);
  };
  if(step===1)return <div className="form-stack">
    <Field label="Твоё имя"><input autoComplete="given-name" inputMode="text" maxLength={48} value={data.name} onChange={e=>patch({name:e.target.value})} placeholder="Как тебя зовут?" /></Field>
    <label className="check-line"><input type="checkbox" checked={data.trialConsent} onChange={e=>patch({trialConsent:e.target.checked})}/><span>Я понимаю, что это тест интерфейса: данные не отправляются на сервер и анкета не публикуется.</span></label>
    <p className="hint">Настоящие правила сервиса и согласия будут предоставлены до запуска регистрации.</p>
  </div>;
  if(step===2)return <div className="form-stack">
    <span className="field-label">Дата рождения</span>
    <div className="dob-grid">
      <Field label="День"><input aria-label="День рождения" inputMode="numeric" autoComplete="bday-day" placeholder="ДД" value={data.day} onChange={e=>dateInput("day",e.target.value)}/></Field>
      <Field label="Месяц"><input ref={monthRef} aria-label="Месяц рождения" inputMode="numeric" autoComplete="bday-month" placeholder="ММ" value={data.month} onChange={e=>dateInput("month",e.target.value)}/></Field>
      <Field label="Год"><input ref={yearRef} aria-label="Год рождения" inputMode="numeric" autoComplete="bday-year" placeholder="ГГГГ" value={data.year} onChange={e=>dateInput("year",e.target.value)}/></Field>
    </div>
    <div className="field-label">Пол</div><div className="choice-grid">
      <Choice chosen={data.gender==="man"} onClick={()=>patch({gender:"man"})}>Мужчина</Choice>
      <Choice chosen={data.gender==="woman"} onClick={()=>patch({gender:"woman"})}>Женщина</Choice>
      <Choice chosen={data.gender==="other"} onClick={()=>patch({gender:"other"})}>Другой вариант</Choice>
    </div>
    <p className="hint">Только для пользователей 18+. Варианты поля пока тестовые и требуют финального согласования.</p>
  </div>;
  if(step===3)return <div className="form-stack">
    <Field label="Страна"><input autoComplete="country-name" value={data.country} maxLength={72} placeholder="Например, Армения" onChange={e=>patch({country:e.target.value})}/></Field>
    <Field label="Город"><input autoComplete="address-level2" value={data.city} maxLength={72} placeholder="Начни вводить город" onChange={e=>patch({city:e.target.value})}/></Field>
    <button disabled className="muted-button" type="button" title="Точный поиск города будет подключён после настройки геосервиса">⌖ Моё местоположение · скоро</button>
    <Field label={"Радиус поиска · "+data.radius+" км"}><input type="range" min={1} max={1000} step={1} value={data.radius} onChange={e=>patch({radius:Number(e.target.value)})}/></Field>
    <p className="hint">Сейчас доступен ручной ввод. Геолокация добровольная, точные координаты не публикуются.</p>
  </div>;
  if(step===4)return <div className="form-stack">
    <div className="field-label">Кого хочешь встретить?</div><div className="choice-grid">
      <Choice chosen={data.audience==="women"} onClick={()=>patch({audience:"women"})}>Женщин</Choice>
      <Choice chosen={data.audience==="men"} onClick={()=>patch({audience:"men"})}>Мужчин</Choice>
      <Choice chosen={data.audience==="everyone"} onClick={()=>patch({audience:"everyone"})}>Всех</Choice>
    </div>
    <div className="field-label">Возраст от {data.ageMin} до {data.ageMax}</div>
    <div className="age-sliders"><Field label="От"><input type="range" aria-label="Возраст от" min={18} max={80} value={data.ageMin} onChange={e=>patch({ageMin:Math.min(Number(e.target.value),data.ageMax)})}/></Field><Field label="До"><input type="range" aria-label="Возраст до" min={18} max={80} value={data.ageMax} onChange={e=>patch({ageMax:Math.max(Number(e.target.value),data.ageMin)})}/></Field></div>
    <div className="field-label">Цель знакомства</div><div className="choice-grid">
      <Choice chosen={data.goal==="relationship"} onClick={()=>patch({goal:"relationship"})}>Отношения</Choice>
      <Choice chosen={data.goal==="dates"} onClick={()=>patch({goal:"dates"})}>Свидания</Choice>
      <Choice chosen={data.goal==="friends"} onClick={()=>patch({goal:"friends"})}>Общение</Choice>
    </div>
    <label className="toggle-row"><span>Искать по всему миру</span><input type="checkbox" checked={data.worldwide} onChange={e=>patch({worldwide:e.target.checked})}/></label>
  </div>;
  if(step===5)return <div className="form-stack interests-step">
    <p className="hint">Тестовый каталог для проверки интерфейса. Итоговый набор интересов будет согласован отдельно.</p>
    <div className="category-row" role="group" aria-label="Категории интересов">
      {interestCategories.map(c=><Choice key={c.name} chosen={category===c.name} onClick={()=>setCategory(c.name)}>{c.name}</Choice>)}
    </div>
    <div className="chips interest-choices">{interestCategories.find(c=>c.name===category)?.items.map((item,i)=><button key={item} type="button" aria-pressed={data.interests.includes(item)} className={"chip selectable tone-"+(i%5)+(data.interests.includes(item)?" selected":"")} onClick={()=>toggleInterest(item)}>{item}</button>)}</div>
    <div className="selected-interests"><strong>Выбрано · {data.interests.length} из 15</strong><div className="chips">{data.interests.length?data.interests.map(x=><button type="button" className="chip selected" onClick={()=>toggleInterest(x)} key={x}>{x} ×</button>):<span className="hint">Можно выбрать понравившиеся интересы</span>}</div></div>
  </div>;
  if(step===6)return <div className="form-stack">
    <Field label="Немного о себе"><textarea value={data.about} rows={6} maxLength={500} placeholder="Что тебя радует? Чем любишь заниматься?" onChange={e=>patch({about:e.target.value})}/></Field>
    <p className="char-count">{data.about.length} / 500</p>
    <div className="field-label">Языки общения</div>
    <div className="choice-grid">{languages.map(language=><Choice key={language} chosen={data.languages.includes(language)} onClick={()=>patch({languages:data.languages.includes(language)?data.languages.filter(x=>x!==language):[...data.languages,language]})}>{language}</Choice>)}</div>
    <p className="hint">Можно пропустить. Вопросы о привычках, ценностях и характере появятся позже в профиле.</p>
  </div>;
  if(step===7)return <div className="form-stack">
    <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onFiles}/>
    <div className="mosaic">{Array.from({length:6},(_,i)=>{
      const photo=photos[i];return <div className={"mosaic-slot"+(i===0?" mosaic-main":"")} key={photo?.id??"empty-"+i} draggable={!!photo} onDragStart={()=>setDragIndex(i)} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,i)} onDragEnd={()=>setDragIndex(null)}>
        {photo?<><img src={photo.src} alt={"Фото "+(i+1)}/>{i===0&&<span className="primary-photo">Главное фото</span>}<button className="remove-photo" type="button" aria-label={"Удалить фото "+(i+1)} onClick={()=>removePhoto(photo.id)}>×</button><div className="photo-actions"><button type="button" disabled={i===0} onClick={()=>movePhoto(i,i-1)} aria-label="Переместить фото левее">←</button><button type="button" disabled={i===photos.length-1} onClick={()=>movePhoto(i,i+1)} aria-label="Переместить фото правее">→</button></div></>
          :i===photos.length?<button className="add-photo" type="button" onClick={pickPhoto} aria-label="Добавить фотографии">+</button>:<span className="empty-number">{i+1}</span>}
      </div>})}</div>
    <p className="hint">Для будущей публикации потребуется 3–6 фото и одобрение модератора. Сейчас файлы видны только на этом устройстве и никуда не загружаются.</p>
  </div>;
  return <div className="form-stack">
    <p className="hint">Предварительный просмотр. Полный публичный профиль будет подключён на Stage 03 — сейчас анкета не публикуется.</p>
    <ProfilePreview data={data} photos={photos}/>
    <div className="review-actions"><button className="muted-button" type="button" onClick={()=>editStep(1)}>Изменить имя</button><button className="muted-button" type="button" onClick={()=>editStep(7)}>Изменить фото</button></div>
    <p className="hint">{photos.length<3?"Для публикации не хватает фотографий. ":""}Отправка на модерацию и кнопка «Начать знакомства» станут доступны после подключения защищённого backend.</p>
    <button className="disabled-submit" type="button" disabled>Начать знакомства · скоро</button>
  </div>;
}
