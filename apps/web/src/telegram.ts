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
/** One viewport owner in browser and Telegram. Never trust initDataUnsafe as identity. */
export function useTelegramBridge(full:boolean,onBack:()=>void,theme:string){
 useEffect(()=>{
  const tg=getTelegram(),vp=window.visualViewport;
  const resize=()=>{const height=vp?.height||tg?.viewportHeight||window.innerHeight;document.documentElement.style.setProperty('--viewport-height',height+'px');};
  if(tg){tg.ready();tg.expand();if(tg.isVersionAtLeast('7.7'))tg.disableVerticalSwipes();tg.onEvent('viewportChanged',resize);}
  resize();vp?.addEventListener('resize',resize);window.addEventListener('resize',resize);
  return()=>{vp?.removeEventListener('resize',resize);window.removeEventListener('resize',resize);tg?.offEvent('viewportChanged',resize);};
 },[]);
 useEffect(()=>{const tg=getTelegram();if(!tg||!tg.isVersionAtLeast('6.1'))return;if(full){tg.BackButton.show();tg.BackButton.onClick(onBack);}else tg.BackButton.hide();return()=>{tg.BackButton.offClick(onBack);tg.BackButton.hide();};},[full,onBack]);
 useEffect(()=>{const tg=getTelegram();if(tg?.isVersionAtLeast('6.1')){tg.setHeaderColor(theme==='dark'?'#191422':'#f8f3fa');tg.setBackgroundColor(theme==='dark'?'#191422':'#f8f3fa');}},[theme]);
}