export type Owner="SHEET"|"PHOTO"|"TABS"|"NATIVE_SCROLL"|"PHOTO_VIEWER"|"ROUTE_BACK"|"TELEGRAM_HOST"|"NONE";
export type Region="handle"|"photo"|"tabs"|"content"|"route";
export type Pointer={id:number;x:number;y:number;time:number};
export type Decision={owner:Owner;dx:number;dy:number;claimed:boolean};
/** Candidate phase leaves native scrolling and route propagation intact. The host
 * attaches pointer capture only after SHEET is claimed. */
export class ProfileGestureCoordinator {
 private candidate:{pointer:Pointer;last:Pointer;region:Region;owner:Owner}|null=null;
 private blocked=false;
 begin(pointer:Pointer,region:Region):boolean{
  if(this.blocked||this.candidate){this.cancel();this.blocked=true;return false;}
  this.candidate={pointer,last:pointer,region,owner:"NONE"};return true;
 }
 move(pointer:Pointer):Decision{
  const c=this.candidate;if(!c||c.pointer.id!==pointer.id)return {owner:"NONE",dx:0,dy:0,claimed:false};
  c.last=pointer;const dx=pointer.x-c.pointer.x,dy=pointer.y-c.pointer.y;
  if(c.owner==="NONE"&&Math.max(Math.abs(dx),Math.abs(dy))>=7){
   const vertical=Math.abs(dy)>Math.abs(dx)*1.15;
   if(c.region==="handle")c.owner=vertical?"SHEET":"ROUTE_BACK";
   else if(c.region==="photo")c.owner=vertical?"TELEGRAM_HOST":"PHOTO";
   else if(c.region==="content")c.owner=vertical?"NATIVE_SCROLL":"TABS";
   else if(c.region==="tabs")c.owner=vertical?"NATIVE_SCROLL":"TABS";
   else c.owner=vertical?"TELEGRAM_HOST":"ROUTE_BACK";
  }
  return {owner:c.owner,dx,dy,claimed:c.owner!=="NONE"};
 }
 /** The caller owns the scroll boundary decision. An expanded sheet claims
  * upward content drags; a compact sheet claims downward pulls at the top. */
 claimSheetFromContent(id:number,direction:"up"|"down"):boolean{
  const c=this.candidate;
  if(!c||c.pointer.id!==id||c.region!=="content"||c.owner!=="NATIVE_SCROLL"||
   (direction==="down"?c.last.y<=c.pointer.y:c.last.y>=c.pointer.y))return false;
  c.owner="SHEET";return true;
 }
 end(id:number):Decision{
  const c=this.candidate;
  if(!c||c.pointer.id!==id)return {owner:"NONE",dx:0,dy:0,claimed:false};
  const result={owner:c.owner,dx:c.last.x-c.pointer.x,dy:c.last.y-c.pointer.y,claimed:c.owner!=="NONE"};
  this.cancel();return result;
 }
 owner():Owner{return this.candidate?.owner??"NONE";}
 cancel(){this.candidate=null;this.blocked=false;}
 secondFinger(){this.candidate=null;this.blocked=true;}
 releaseSecondFinger(){this.blocked=false;}
 dispose(){this.cancel();}
}
