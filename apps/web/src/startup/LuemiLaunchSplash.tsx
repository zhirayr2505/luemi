import {useEffect,useRef} from "react";

const quotes=[
 "Возможно, сегодня начнётся что-то красивое",
 "Твоя история продолжается",
 "Кто-то уже может ждать встречи с тобой",
 "Иногда всё начинается с одного свайпа",
 "Твоя следующая встреча ближе, чем кажется"
];

export function LuemiLaunchSplash({logoSrc,onComplete}:{logoSrc:string;onComplete:()=>void}){
 const done=useRef(false);
 const quote=quotes[Math.floor(Math.random()*quotes.length)];
 useEffect(()=>{
  const timer=window.setTimeout(()=>{if(!done.current){done.current=true;onComplete();}},1450);
  return()=>window.clearTimeout(timer);
 },[onComplete]);
 return <main className="luemi-launch-splash" aria-live="polite" role="status">
   <div className="luemi-launch-glow" aria-hidden="true"/>
   <img src={logoSrc} alt="LUEMI" className="luemi-launch-logo"/>
   <p>{quote}</p>
   <span className="luemi-launch-loader" aria-hidden="true"><i/><i/><i/></span>
 </main>;
}
