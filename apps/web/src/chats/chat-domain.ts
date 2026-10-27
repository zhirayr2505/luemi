import type {ChatMessageContract} from "@luemi/contracts";

export type LocalMessage=ChatMessageContract&{localState?:"sending"|"failed";localPreviewUrl?:string};
export const sortMessages=(items:LocalMessage[])=>[...items].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
export function reconcileMessages(current:LocalMessage[],incoming:ChatMessageContract[]):LocalMessage[]{
 const byId=new Map(current.map(message=>[message.id,message]));
 const optimisticByClient=new Map(current.filter(m=>m.localState).map(m=>[m.clientId,m]));
 for(const message of incoming){const optimistic=optimisticByClient.get(message.clientId);if(optimistic&&optimistic.id!==message.id)byId.delete(optimistic.id);byId.set(message.id,message);}
 return sortMessages([...byId.values()]);
}
export function prependPage(current:LocalMessage[],older:ChatMessageContract[]){return reconcileMessages(older,current);}
export const isNearBottom=(element:Pick<HTMLElement,"scrollHeight"|"scrollTop"|"clientHeight">,threshold=96)=>element.scrollHeight-element.scrollTop-element.clientHeight<threshold;
export const errorText=(status:number,code:string)=>{
 if(status===401)return "Сессия истекла. Открой LUEMI заново через Telegram.";
 if(status===403)return "Доступ к переписке закрыт.";
 if(status===404)return "Переписка больше недоступна.";
 if(status===409)return "Это сообщение уже было отправлено с другим содержимым.";
 if(status===429)return "Слишком много действий. Попробуй чуть позже.";
 if(status===0||code==="offline")return "Нет соединения. Сообщение можно повторить после подключения.";
 return "Не удалось выполнить действие. Попробуй ещё раз.";
};
export function validateChatImage(file:Pick<File,"size"|"type">):string|null{
 if(file.size<1||file.size>10*1024*1024)return "Фото должно быть не больше 10 МБ.";
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))return "Можно выбрать JPEG, PNG или WebP.";
 return null;
}
