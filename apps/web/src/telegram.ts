import {useEffect} from 'react';
type TelegramWebApp={
 initData:string;platform:string;viewportHeight:number;viewportStableHeight:number;
 ready:()=>void;expand:()=>void;isVersionAtLeast:(version:string)=>boolean;
 disableVerticalSwipes:()=>void;setHeaderColor:(color:string)=>void;setBackgroundColor:(color:string)=>void;
 BackButton:{show:()=>void;hide:()=>void;onClick:(callback:()=>void)=>void;offClick:(callback:()=>void)=>void};
 onEvent:(name:string,callback:()=>void)=>void;offEvent:(name:string,callback:()=>void)=>void;
};
declare global{interface Window{Telegram?:{WebApp?:TelegramWebApp}}}
export function getTelegram(){const app=window.Telegram?.WebApp;return app&&app.platform!=='unknown'?app:undefined;}
/** One stable viewport owner. Browser URL bar changes MUST NOT resize the profile mid-gesture. */
export function useTelegramBridge(full:boolean,onBack:()=>void,theme:string){
 useEffect(()=>{
  const tg=getTelegram(),vp=window.visualViewport;
  let lastWidth=window.innerWidth;
  let stableHeight=(tg?.viewportStableHeight||window.innerHeight);
  const resize=()=>{
   const candidate=tg?.viewportStableHeight||window.innerHeight;
   const input=document.activeElement;
   const keyboard=input instanceof HTMLElement&&!!input.closest('input,textarea,[contenteditable="true"]');
   const rotated=window.innerWidth!==lastWidth;
   // Browser address bars resize by ~50px while a user scrolls. Ignore that jitter.
   if(tg||rotated||keyboard||Math.abs(candidate-stableHeight)>155){stableHeight=candidate;lastWidth=window.innerWidth;}
   document.documentElement.style.setProperty('--viewport-height',Math.max(280,stableHeight)+'px');
  };
  if(tg){tg.ready();tg.expand();if(tg.isVersionAtLeast('7.7'))tg.disableVerticalSwipes();tg.onEvent('viewportChanged',resize);}
  resize();vp?.addEventListener('resize',resize);window.addEventListener('resize',resize);
  return()=>{vp?.removeEventListener('resize',resize);window.removeEventListener('resize',resize);tg?.offEvent('viewportChanged',resize);};
 },[]);
 useEffect(()=>{const tg=getTelegram();if(!tg||!tg.isVersionAtLeast('6.1'))return;if(full){tg.BackButton.show();tg.BackButton.onClick(onBack);}else tg.BackButton.hide();return()=>{tg.BackButton.offClick(onBack);tg.BackButton.hide();};},[full,onBack]);
 useEffect(()=>{const tg=getTelegram();if(tg?.isVersionAtLeast('6.1')){tg.setHeaderColor(theme==='dark'?'#191422':'#f8f3fa');tg.setBackgroundColor(theme==='dark'?'#191422':'#f8f3fa');}},[theme]);
}