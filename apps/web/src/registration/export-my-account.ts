import {geoCsrf} from "../auth/session-adapter";

/** User-initiated data export: no arbitrary actor IDs, no admin token and no
 * hidden chat content. Original camera files are not stored by LUEMI. */
export async function exportMyAvailableData():Promise<void>{
 const csrf=geoCsrf();
 if(!csrf)throw new Error("telegram_session_required");
 const headers={"X-Luemi-CSRF":csrf};
 async function read(path:string):Promise<unknown>{
  const response=await fetch(path,{credentials:"same-origin",headers,cache:"no-store"});
  if(!response.ok)throw new Error("export_endpoint_unavailable");
  return response.json() as Promise<unknown>;
 }
 const [identity,draft,profile,preview,list]=await Promise.all([
  read("/api/v2/me"),read("/api/v3/registration/draft"),
  read("/api/v3/profile/status"),read("/api/v2/profile/preview"),read("/api/v4/chats")
 ]);
 const rows=(list as {conversations?:unknown}).conversations;
 if(!Array.isArray(rows)||rows.length>100)throw new Error("export_list_unavailable");
 const conversations:Array<{id:string;messages:unknown[]}>= [];
 for(const item of rows){
  if(!item||typeof item!=="object"||!("id" in item)||typeof item.id!=="string"||
   !/^[0-9a-f-]{36}$/i.test(item.id))throw new Error("export_invalid_chat");
  const messages:unknown[]=[];
  const cursors=new Set<string>();
  let cursor:string|null=null;
  for(let page=0;page<200;page++){
   const result=await read("/api/v4/chats/"+encodeURIComponent(item.id)+"/export"+
     (cursor?"?before="+encodeURIComponent(cursor):"")) as
     {format?:string;messages?:unknown;nextCursor?:string|null};
   if(result.format!=="luemi-chat-export-v1"||!Array.isArray(result.messages))
    throw new Error("export_invalid_page");
   messages.push(...result.messages);
   if(messages.length>20000)throw new Error("export_too_large");
   if(!result.nextCursor){cursor=null;break;}
   if(cursors.has(result.nextCursor))throw new Error("export_cursor_loop");
   cursors.add(result.nextCursor);cursor=result.nextCursor;
  }
  if(cursor)throw new Error("export_incomplete");
  conversations.push({id:item.id,messages:messages.reverse()});
 }
 const document={format:"luemi-my-data-v1",generatedAt:new Date().toISOString(),
  notice:"Личный экспорт доступных данных. Не включает скрытые для обоих сообщения, чужие закрытые сведения, оригинальные фото с устройства, материалы закрытых жалоб или данные, подлежащие отдельной юридической процедуре.",
  identity,draft,profile,preview,conversations};
 const json=JSON.stringify(document,null,2);
 if(json.length>16*1024*1024)throw new Error("export_too_large");
 const url=URL.createObjectURL(new Blob([json],{type:"application/json;charset=utf-8"}));
 try{
  const a=documentCreateAnchor(url);
  a.click();
  a.remove();
 }finally{window.setTimeout(()=>URL.revokeObjectURL(url),12000);}
}
function documentCreateAnchor(url:string):HTMLAnchorElement{
 const a=document.createElement("a");a.href=url;a.download="luemi-my-data.json";
 a.rel="noopener";document.body.append(a);return a;
}
