import {useTelegramBridge} from './telegram';
import {MotionProvider,SlideDeck} from './motion/SlideDeck';
import {useEffect,useRef,useState} from 'react';
import {type Profile,alina} from '../../../packages/core/domain';
import {loadState,saveState} from './storage';
import {Button,Icon,IconButton,Logo,Modal,PublicProfile} from './ui';
import {Onboarding} from './Onboarding';
import {Discovery} from './Discovery';
import {Likes,Chats,Chat} from './Social';
import {ProfilePage} from './Profile';
const SECTION_ORDER=['Знакомства','Симпатии','Чаты','Профиль','chat','profile'];
export default function App(){
 const [state,setState]=useState(loadState),[tab,setTab]=useState('Знакомства'),[wizard,setWizard]=useState(false),[chat,setChat]=useState(''),[profile,setProfile]=useState<Profile|null>(null),[toast,setToast]=useState(''),[dialog,setDialog]=useState(''),[report,setReport]=useState('Спам'),[theme,setTheme]=useState('light');const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),touch=useRef({x:0,y:0});
 function notify(message:string){setToast(message);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4500);}
 useEffect(()=>{if(!saveState(state))notify('Хранилище устройства заполнено. Последние изменения могут не сохраниться.');},[state]);
 useEffect(()=>{const mq=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{const v=state.theme==='system'?(mq.matches?'dark':'light'):state.theme;setTheme(v);document.documentElement.dataset.luemiTheme=v;document.documentElement.dataset.reducedMotion=String(state.reducedMotion);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',v==='dark'?'#191422':'#f8f3fa');};apply();mq.addEventListener('change',apply);return()=>mq.removeEventListener('change',apply);},[state.theme,state.reducedMotion]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(profile)setProfile(null);else if(chat)setChat('');}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[profile,chat]);
 function openChat(id:string){setTab('Чаты');setChat(id);setProfile(null);}
 function back(){if(profile)setProfile(null);else setChat('');}
 const props={state,setState,openChat,openProfile:setProfile,notify};
 const full=!!chat||!!profile;
 useTelegramBridge(full,back,theme);
 const lastProfile=useRef<Profile|null>(null);if(profile)lastProfile.current=profile;const shownProfile=profile||lastProfile.current;
 const sectionPages={
  'Знакомства':<main className="content"><Discovery {...props}/></main>,
  'Симпатии':<main className="content"><Likes {...props}/></main>,
  'Чаты':<main className="content"><Chats {...props}/></main>,
  'Профиль':<main className="content"><ProfilePage {...props} onRegister={()=>{if(state.onboarded)setState(s=>({...s,step:1}));setWizard(true);}}/></main>,
  profile:shownProfile?<main className="content profile-detail"><PublicProfile profile={shownProfile}/>{shownProfile.id!=='self'&&<div className="profile-cta"><Button variant="primary wide" onClick={()=>{if(state.matches.includes(shownProfile.id))openChat(shownProfile.id);else{setTab('Знакомства');setProfile(null);setChat('');notify('Нажми «Нравится» под анкетой, чтобы проверить взаимный мэтч.');}}}>{state.matches.includes(shownProfile.id)?'Написать':'Перейти к знакомству'}</Button></div>}</main>:null,
  chat:<div className="chat-screen" onPointerDown={e=>{touch.current={x:e.clientX,y:e.clientY};}} onPointerUp={e=>{const dx=e.clientX-touch.current.x,dy=e.clientY-touch.current.y;if(dx>100&&Math.abs(dx)>Math.abs(dy)*1.5&&!((e.target as HTMLElement).closest('textarea,input,button'))){setChat('');}}}><Chat {...props}/></div>
 };
 return <MotionProvider reduced={state.reducedMotion}><div className={'app-frame '+(full?'full-screen':'')+(wizard?' wizard-frame':'')}>
 {wizard?<Onboarding state={state} setState={setState} onClose={()=>{setWizard(false);setTab('Профиль');}} notify={notify}/>:<>
 <button className="demo-ribbon" onClick={()=>setDialog('О демоверсии')}><span/> Закрытая демоверсия <span className="ribbon-dot">·</span> данные на устройстве <Icon name="info" size={13}/></button>
 <header className="app-header"><IconButton icon={full?'back':'tab-chats'} label={full?'Назад':'Перейти в чаты'} onClick={()=>full?back():setTab('Чаты')}/><Logo/><IconButton icon={full?'more':tab==='Знакомства'?'filter':'sun'} label={full?'Действия':tab==='Знакомства'?'Фильтры':'Переключить тему'} onClick={()=>{if(full)setDialog('Действия');else if(tab==='Знакомства')document.getElementById('open-filters')?.click();else setState(s=>({...s,theme:theme==='light'?'dark':'light'}));}}/></header>
 <SlideDeck active={profile?'profile':chat?'chat':tab} order={SECTION_ORDER} pages={sectionPages}/>

 {!full&&<nav className="bottom-nav glass" aria-label="Основная навигация" style={{'--nav-index':SECTION_ORDER.indexOf(tab)} as React.CSSProperties}><span className="nav-indicator" aria-hidden="true"/>{[{name:'Знакомства',icon:'tab-discover',badge:0},{name:'Симпатии',icon:'tab-likes',badge:state.matches.length},{name:'Чаты',icon:'tab-chats',badge:0},{name:'Профиль',icon:'tab-profile',badge:0}].map(item=><button className={item.name===tab?'active':''} aria-current={item.name===tab?'page':undefined} key={item.name} onClick={()=>setTab(item.name)}><span className="nav-icon"><Icon name={item.icon} size={27}/>{item.badge>0&&<b>{item.badge}</b>}</span><span>{item.name}</span></button>)}</nav>}
 </>}
 {toast&&<div className="toast" role="status">{toast}</div>}
 {dialog&&<Modal title={dialog} onClose={()=>setDialog('')}>
 {dialog==='О демоверсии'&&<><p>Это первая рабочая версия LUEMI по утверждённым макетам и библиотеке W12.</p><p>Анкета Алины и история разговора — демонстрационные. Твои изменения, фото и сообщения сохраняются только в этом браузере.</p><p>В приложении уже можно пройти регистрацию, проверить симпатии, переписку, профиль и смену темы.</p><Button variant="primary wide" onClick={()=>{setDialog('');setWizard(true);}}>Пройти регистрацию</Button></>}
 {dialog==='Действия'&&(profile?.id==='self'?<Button variant="primary wide" onClick={()=>{setProfile(null);setChat('');setDialog('');setState(s=>({...s,step:1}));setWizard(true);}}>Редактировать профиль</Button>:<div className="menu-list"><button onClick={()=>{setDialog('');setProfile(alina);}}>Посмотреть профиль</button><button onClick={()=>setDialog('Пожаловаться')}>Пожаловаться</button><button className="danger" onClick={()=>setDialog('Заблокировать Алину?')}>Заблокировать</button></div>)}
 {dialog==='Пожаловаться'&&<><p>В демоверсии жалоба сохранится только на устройстве и не поступит модератору.</p><label className="field">Причина<select value={report} onChange={e=>setReport(e.target.value)}>{['Спам','Мошенничество','Оскорбления','Угрозы','Нежелательные материалы','Другое'].map(x=><option key={x}>{x}</option>)}</select></label><Button variant="primary wide" onClick={()=>{setState(s=>({...s,reports:[...s.reports,{id:'alina',reason:report,at:new Date().toISOString()}]}));setDialog('');notify('Демо-жалоба сохранена локально. Модерация пока не подключена.');}}>Сохранить демо-жалобу</Button></>}
 {dialog==='Заблокировать Алину?'&&<><p>Демо-анкета исчезнет из Ленты, Симпатий и Чатов. Разблокировать можно в настройках.</p><Button variant="primary wide" onClick={()=>{setState(s=>({...s,blocked:[...new Set([...s.blocked,'alina'])]}));setDialog('');setProfile(null);setChat('');notify('Анкета заблокирована в демоверсии.');}}>Заблокировать</Button><Button variant="text wide" onClick={()=>setDialog('')}>Отмена</Button></>}
 </Modal>}
 </div></MotionProvider>;
}