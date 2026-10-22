/** REM-01C / LU-21. Read a bounded header, never decode the original to learn its size. */
export interface PhotoHeader {
 format:"jpeg"|"png"|"webp";
 width:number;height:number;
 /** EXIF orientation is advisory; browsers apply image orientation during decode. */
 orientation:1|2|3|4|5|6|7|8;
}
export const MAX_PREVIEW_SOURCE_PIXELS=32_000_000;
export const MAX_PREVIEW_SIDE=2048;
export const MAX_HEADER_BYTES=262_144;
export const MAX_PHOTO_BYTES=12*1024*1024;
/** 32 MP x 4 = 128 MB decoded RGBA, + up to 16 MB output + implementation copies.
 * Conservative, provisional Android WebView budget; NOT physically measured on A55/iOS.
 * Increase only after peak-memory measurement and separate decision. */
export const ESTIMATED_RGBA_BUDGET_BYTES=MAX_PREVIEW_SOURCE_PIXELS*4;
const corrupt=()=>new Error("PHOTO_HEADER_INVALID");
const unsupported=()=>new Error("PHOTO_DIMENSIONS_UNSUPPORTED");
const u16=(data:DataView,i:number,little=false)=>data.getUint16(i,little);
const u32=(data:DataView,i:number,little=false)=>data.getUint32(i,little);
function exifOrientation(b:DataView,start:number,end:number):PhotoHeader["orientation"]{
 if(start+14>end||u32(b,start)!==0x45786966||u16(b,start+4)!==0)return 1;
 const t=start+6;
 const order=u16(b,t);
 if(order!==0x4949&&order!==0x4d4d)return 1;
 const le=order===0x4949;
 if(u16(b,t+2,le)!==42)return 1;
 const ifd=t+u32(b,t+4,le);
 if(ifd<t+8||ifd+2>end)return 1;
 const count=u16(b,ifd,le);
 if(count>1024||ifd+2+count*12>end)return 1;
 for(let n=0;n<count;n++){
  const entry=ifd+2+n*12;
  if(u16(b,entry,le)===0x0112&&u16(b,entry+2,le)===3&&u32(b,entry+4,le)===1){
   const orientation=u16(b,entry+8,le);
   if(orientation>=1&&orientation<=8)return orientation as PhotoHeader["orientation"];
  }
 }
 return 1;
}
function jpeg(data:DataView):PhotoHeader{
 const len=data.byteLength;
 if(len<4||u16(data,0)!==0xffd8)throw corrupt();
 let offset=2,orientation:PhotoHeader["orientation"]=1;
 // Support baseline/progressive/lossless SOF families; reject crafted segment overruns.
 const frames=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
 while(offset+4<=len){
  if(data.getUint8(offset)!==0xff)throw corrupt();
  while(offset<len&&data.getUint8(offset)===0xff)offset++;
  if(offset>=len)throw corrupt();
  const marker=data.getUint8(offset++);
  if(marker===0xd9||marker===0xda)break;
  if(marker===0x00||marker===0xd8||marker>=0xd0&&marker<=0xd7||marker===0x01)continue;
  if(offset+2>len)throw corrupt();
  const segmentLength=u16(data,offset);
  if(segmentLength<2||offset+segmentLength>len)throw corrupt();
  if(marker===0xe1)orientation=exifOrientation(data,offset+2,offset+segmentLength);
  if(frames.has(marker)){
   if(segmentLength<8||offset+8>len)throw corrupt();
   return {format:"jpeg",width:u16(data,offset+5),height:u16(data,offset+3),orientation};
  }
  offset+=segmentLength;
 }
 throw corrupt();
}
function png(data:DataView):PhotoHeader{
 if(data.byteLength<33||u32(data,0)!==0x89504e47||u32(data,4)!==0x0d0a1a0a||
   u32(data,8)!==13||u32(data,12)!==0x49484452)throw corrupt();
 const width=u32(data,16),height=u32(data,20),depth=data.getUint8(24),color=data.getUint8(25);
 const channels=[0,2,3,4,6];
 if(![1,2,4,8,16].includes(depth)||!channels.includes(color)||data.getUint8(26)!==0||
    data.getUint8(27)!==0||data.getUint8(28)>1)throw corrupt();
 return {format:"png",width,height,orientation:1};
}
function webp(data:DataView):PhotoHeader{
 if(data.byteLength<25||u32(data,0,true)!==0x46464952||u32(data,8)!==0x57454250)throw corrupt();
 const riffSize=u32(data,4,true);
 if(riffSize<17||riffSize+8<25)throw corrupt();
 const kind=u32(data,12,true),size=u32(data,16,true);
 if(size>riffSize-12)throw corrupt();
 let width=0,height=0;
 if(kind===0x58385056){ // VP8X
  if(size<10||data.byteLength<30)throw corrupt();
  width=1+data.getUint8(24)+(data.getUint8(25)<<8)+(data.getUint8(26)<<16);
  height=1+data.getUint8(27)+(data.getUint8(28)<<8)+(data.getUint8(29)<<16);
 }else if(kind===0x20385056){ // VP8 (lossy)
  if(size<10||data.byteLength<30||data.getUint8(23)!==0x9d||data.getUint8(24)!==0x01||data.getUint8(25)!==0x2a)throw corrupt();
  width=u16(data,26,true)&0x3fff;height=u16(data,28,true)&0x3fff;
 }else if(kind===0x4c385056){ // VP8L (lossless)
  if(size<5||data.byteLength<25||data.getUint8(20)!==0x2f)throw corrupt();
  const packed=u32(data,21,true);
  width=1+(packed&0x3fff);height=1+((packed>>>14)&0x3fff);
 }else throw corrupt();
 return {format:"webp",width,height,orientation:1};
}
export function parsePhotoHeader(bytes:ArrayBuffer,mime:string):PhotoHeader{
 const data=new DataView(bytes);
 const header=mime==="image/jpeg"?jpeg(data):
  mime==="image/png"?png(data):mime==="image/webp"?webp(data):null;
 if(!header)throw corrupt();
 const {width,height}=header;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
   width<1||height<1||width>65_535||height>65_535||
   width*height>MAX_PREVIEW_SOURCE_PIXELS)throw unsupported();
 return header;
}
export async function inspectPhoto(file:Blob,signal:AbortSignal):Promise<PhotoHeader>{
 signal.throwIfAborted();
 if(file.size===0||file.size>MAX_PHOTO_BYTES||
   !["image/jpeg","image/png","image/webp"].includes(file.type))throw corrupt();
 const bytes=await file.slice(0,MAX_HEADER_BYTES).arrayBuffer();
 signal.throwIfAborted();
 if(file.type==="image/webp"&&bytes.byteLength>=12){
  const riff=new DataView(bytes);
  if(riff.getUint32(0,true)===0x46464952&&riff.getUint32(4,true)+8>file.size)throw corrupt();
 }
 return parsePhotoHeader(bytes,file.type);
}
