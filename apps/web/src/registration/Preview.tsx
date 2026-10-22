import {Pencil,Info} from "lucide-react";
import type {RegistrationDraft} from "./model";
import type {PhotoItem} from "./PhotoSorter";
import {fromLocalDraft,readyRegistrationPhotos} from "../discovery/ProfileModel";
import {ProfileMaster} from "../discovery/ProfileMaster";

interface Props {
 data:RegistrationDraft;photos:PhotoItem[];
 editStep:(step:number)=>void;openDemo:()=>void;
}
/** Stage 8 uses the same ProfileMaster renderer and projection as the owner
 * profile in Discovery. This is a local SELF simulation, not public exposure. */
export function RegistrationPreview({data,photos,editStep,openDemo}:Props){
 const prepared=readyRegistrationPhotos(photos);
 const profile=fromLocalDraft(data,prepared);
 const missing=Math.max(0,3-prepared.length);
 const pending=photos.filter(p=>p.status==="reading").length;
 const failed=photos.filter(p=>p.status==="error").length;
 return <div className="preview-root">
   <p className="hint">Так будет выглядеть твоя анкета в LUEMI. Это локальный черновик, а не опубликованный профиль: другие люди его пока не видят.</p>
   <section className="registration-profile-simulator" aria-label="Локальный предпросмотр профиля">
     <ProfileMaster data={profile} mode="local-self-preview"/>
   </section>
   {(pending>0||failed>0)&&<p className="hint" role="status">
     <Info size={14} aria-hidden="true"/> Не включены в предпросмотр: {pending>0?`обрабатываются — ${pending}`:""}
     {pending>0&&failed>0?", ":""}{failed>0?`ошибки — ${failed}`:""}. Вернись к фотографиям, чтобы исправить их.
   </p>}
   <button className="glass-choice edit-profile-action" type="button" onClick={()=>editStep(7)}>
     <Pencil size={18}/> Изменить анкету
   </button>
   {missing>0&&<p className="hint">Для будущей публикации нужно ещё {missing} готовых фото.</p>}
   <button type="button" className="primary-action" onClick={openDemo}>
     Открыть демо-Ленту <span aria-hidden="true">→</span>
   </button>
   <p className="hint">Демо-анкеты вымышлены. Действия ничего не публикуют и никому не отправляются. Вкладка «Как будет выглядеть» показывает только локальную симуляцию.</p>
   <button type="button" className="disabled-submit" disabled>Публикация анкеты пока закрыта</button>
 </div>;
}
