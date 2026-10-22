import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const path=new URL("../apps/web/src/registration/photo-header.ts",import.meta.url);
const compiled=ts.transpileModule(readFileSync(path,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const q=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const buffer=(bytes)=>Uint8Array.from(bytes).buffer;
const u32=(array,offset,n,little=false)=>new DataView(array.buffer).setUint32(offset,n,little);
const png=(w,h)=>{
 const d=new Uint8Array(33);
 d.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
 u32(d,16,w);u32(d,20,h);d[24]=8;d[25]=6;
 return d.buffer;
};
const jpeg=(w,h,orientation=1)=>{
 const exif=[
  0xff,0xd8,0xff,0xe1,0,34,
  ...Buffer.from("Exif\0\0","binary"),
  0x49,0x49,42,0,8,0,0,0,1,0,
  0x12,1,3,0,1,0,0,0,orientation,0,0,0,0,0,0,0,
  0xff,0xc2,0,17,8,h>>8,h&255,w>>8,w&255,3,
  1,0x11,0,2,0x11,1,3,0x11,1,0xff,0xd9
 ];
 return buffer(exif);
};
const webpX=(w,h)=>{
 const a=new Uint8Array(30);
 a.set(Buffer.from("RIFF"),0);u32(a,4,22,true);
 a.set(Buffer.from("WEBPVP8X"),8);u32(a,16,10,true);
 let x=w-1,y=h-1;
 for(let i=0;i<3;i++){a[24+i]=(x>>>(i*8))&255;a[27+i]=(y>>>(i*8))&255;}
 return a.buffer;
};
const webpLossy=()=>{
 const a=new Uint8Array(30);
 a.set(Buffer.from("RIFF"),0);u32(a,4,22,true);
 a.set(Buffer.from("WEBPVP8 "),8);u32(a,16,10,true);
 a[23]=0x9d;a[24]=1;a[25]=0x2a;a[26]=0x20;a[27]=0x03;a[28]=0x58;a[29]=0x02;
 return a.buffer;
};
const webpLossless=()=>{
 const a=new Uint8Array(25);
 a.set(Buffer.from("RIFF"),0);u32(a,4,17,true);
 a.set(Buffer.from("WEBPVP8L"),8);u32(a,16,5,true);
 a[20]=0x2f;const w=320,h=400,packed=(w-1)|((h-1)<<14);
 u32(a,21,packed,true);return a.buffer;
};
assert.deepEqual([q.parsePhotoHeader(png(2048,1536),"image/png").width,
q.parsePhotoHeader(png(2048,1536),"image/png").height],[2048,1536]);
assert.deepEqual([q.parsePhotoHeader(jpeg(4000,3000,6),"image/jpeg").width,
q.parsePhotoHeader(jpeg(4000,3000,6),"image/jpeg").orientation],[4000,6]);
assert.equal(q.parsePhotoHeader(webpX(800,600),"image/webp").height,600);
assert.equal(q.parsePhotoHeader(webpLossy(),"image/webp").width,800);
assert.equal(q.parsePhotoHeader(webpLossless(),"image/webp").height,400);
for(const [bytes,mime] of [
 [png(30000,30000),"image/png"],[png(0,500),"image/png"],
 [png(65_536,1),"image/png"],[jpeg(10000,10000),"image/jpeg"],
 [buffer([0xff,0xd8,0xff,0xe1,255,255]),"image/jpeg"],
 [buffer([0xff,0xd8,0xff,0xda]),"image/jpeg"],
 [buffer([0,0,0,0,0]),"image/png"],
 [webpX(16000,16000),"image/webp"],[buffer([82,73,70,70,0]),"image/webp"]
])assert.throws(()=>q.parsePhotoHeader(bytes,mime),/PHOTO_/);
assert.equal(q.MAX_PREVIEW_SIDE,2048);
assert.equal(q.MAX_PREVIEW_SOURCE_PIXELS,32_000_000);
assert.equal(q.MAX_PHOTO_BYTES,12*1024*1024);
console.log("REM01C_HEADER_PASS JPEG progressive+EXIF6, PNG, VP8/VP8L/VP8X, huge pixels, corrupt/truncated, fixed budgets");
