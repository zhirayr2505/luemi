/** REM-03A / LU-05. Viewer identity and navigation contract, no animation writer. */
import type {ProfilePhoto} from "./ProfileModel";

export type ViewerPhase="opening"|"idle"|"draggingX"|"draggingY"|"pinching"|"settling"|"closing"|"disposed";
export type NavigationOrigin="keyboard"|"button"|"swipe"|"internal"|"reconcile";
export type NavigationRequest={direction:-1|1}|{photoId:string};
export interface PhotoViewerSession{
 viewerId:string;generation:number;committedPhotoId:string|null;
 targetPhotoId:string|null;phase:ViewerPhase;geometryRevision:number;
}
export interface ViewerSource{
 photoId:string;contextId:string;resourceKey:string;
 resolveElement:()=>HTMLElement|null;
}
export const resourceIdentity=(photo:Pick<ProfilePhoto,"id"|"src"> & {version?:string}):string=>
 JSON.stringify([photo.id,photo.src,photo.version??""]);
export const photoIndex=(photos:readonly ProfilePhoto[],id:string|null):number=>
 id===null?-1:photos.findIndex(p=>p.id===id);
/** Preserve ID over reorder. On removal, prefer same prior position, then previous. */
export function reconcilePhotoId(id:string|null,previous:readonly string[],
 photos:readonly ProfilePhoto[]):string|null{
 if(!photos.length)return null;
 if(id!==null&&photos.some(p=>p.id===id))return id;
 const position=id===null?0:Math.max(0,previous.indexOf(id));
 return photos[Math.min(position,photos.length-1)].id;
}
export function requestNavigation(
 current:string|null,photos:readonly ProfilePhoto[],request:NavigationRequest
):string|null{
 if(current===null||!photos.length)return null;
 const start=photoIndex(photos,current);
 if(start<0)return null;
 const target="direction" in request?start+request.direction:photoIndex(photos,request.photoId);
 return target>=0&&target<photos.length?photos[target].id:null;
}
export function sourceMatches(source:ViewerSource|null,currentId:string|null,
 contextId:string,currentKey:string|null):boolean{
 if(!source||source.photoId!==currentId||source.contextId!==contextId||
  source.resourceKey!==currentKey)return false;
 const el=source.resolveElement();
 return !!el?.isConnected&&el.dataset.photoId===source.photoId;
}
export function viewerPhotoContext(view:{profile:{id:string|null;source:string;name:string}}):string{
 return JSON.stringify([view.profile.id,view.profile.source,view.profile.name]);
}
