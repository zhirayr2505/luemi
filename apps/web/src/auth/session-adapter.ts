import type {BootstrapResponse} from "@luemi/contracts";
let geoCsrfToken: string | null = null;
export function geoCsrf():string|null{return geoCsrfToken;}
export type AuthStartupIdentity = BootstrapResponse | {mode:"session_v2";user:{id:string;firstName:string}};
/** REM-05B v2 is explicitly opt-in at build time; existing Telegram demo is unchanged by default.
 * This adapter NEVER persists initData, session material, cookies or bearer credentials. */
export async function authenticateBootstrap(initData:string,signal:AbortSignal):Promise<AuthStartupIdentity|null>{
 geoCsrfToken=null;
 const enabled=import.meta.env.VITE_LUEMI_AUTH_V2==="1";
 const response=await fetch(enabled?"/api/v2/auth/telegram":"/api/auth/telegram",{
  method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
  body:JSON.stringify({initData}),signal,cache:"no-store"
 });
 if(response.status===503&&!enabled)return null;
 if(!response.ok)throw new Error(enabled?"Session bootstrap rejected":"Telegram authorization failed");
 if(!enabled)return (await response.json()) as BootstrapResponse;
 const result:unknown=await response.json();
 if(!result||typeof result!=="object"||!Object.hasOwn(result,"user"))throw new Error("Invalid session envelope");
 const user=(result as {user?:{id?:unknown;firstName?:unknown}}).user;
 if(!user||typeof user.id!=="string"||!(/^[0-9a-f-]{36}$/i.test(user.id))||
   typeof user.firstName!=="string")throw new Error("Invalid session identity");
 // A third-party iframe may silently drop Secure cookies. Never enable the
 // untested memory-bearer fallback: demand proof of a working cookie here.
 const checked=await fetch("/api/v2/auth/session",{credentials:"same-origin",signal,cache:"no-store"});
 if(!checked.ok)throw new Error("Telegram session cookie unavailable");
 const confirmed:unknown=await checked.json();
 if(!confirmed||typeof confirmed!=="object"||(confirmed as {user?:{id?:unknown}}).user?.id!==user.id)
   throw new Error("Session identity mismatch");
 const csrf=(confirmed as {csrfToken?:unknown}).csrfToken;
 if(typeof csrf!=="string"||!(/^[A-Za-z0-9_-]{32,128}$/.test(csrf)))
   throw new Error("Invalid session CSRF token");
 geoCsrfToken=csrf; // memory-only, never persisted
 return {mode:"session_v2",user:{id:user.id,firstName:user.firstName}};
}
