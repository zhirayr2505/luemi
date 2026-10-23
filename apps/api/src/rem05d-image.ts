// REM-05D isolated PNG-only processor: decode, bound pixels, re-encode without metadata.
// Intentionally no JPEG/HEIC/AVIF or public image admission until hardened processor approval.
import {deflateSync,inflateSync} from "node:zlib";
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_BYTES=1_048_576,MAX_PIXELS=4_000_000,MAX_SIDE=2048;
export class UnsafeImageError extends Error{constructor(){super("invalid_image");}}
export type CleanPng={bytes:Buffer;width:number;height:number;shaInputBytes:number};
const table=Array.from({length:256},(_,i)=>{
 let c=i;for(let j=0;j<8;j++)c=c&1?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;
});
function crc(b:Buffer){let c=0xffffffff;for(const v of b)c=table[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(name:string,value:Buffer){
 const tag=Buffer.from(name,"ascii"),len=Buffer.alloc(4),sum=Buffer.alloc(4);
 len.writeUInt32BE(value.length);sum.writeUInt32BE(crc(Buffer.concat([tag,value])));
 return Buffer.concat([len,tag,value,sum]);
}
function unfilter(data:Buffer,width:number,height:number,channels:number):Buffer{
 const stride=width*channels;
 const output=Buffer.alloc(stride*height);
 let pos=0;
 for(let y=0;y<height;y++){
  const filter=data[pos++];
  if(filter>4)throw new UnsafeImageError();
  for(let x=0;x<stride;x++){
   const raw=data[pos++],left=x>=channels?output[y*stride+x-channels]:0;
   const up=y?output[(y-1)*stride+x]:0;
   const upperLeft=y&&x>=channels?output[(y-1)*stride+x-channels]:0;
   let predictor=0;
   if(filter===1)predictor=left;
   else if(filter===2)predictor=up;
   else if(filter===3)predictor=Math.floor((left+up)/2);
   else if(filter===4){
    const p=left+up-upperLeft,a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-upperLeft);
    predictor=a<=b&&a<=c?left:b<=c?up:upperLeft;
   }
   output[y*stride+x]=(raw+predictor)&255;
  }
 }
 return output;
}
export function sanitizePng(source:Buffer):CleanPng{
 try{
  if(!Buffer.isBuffer(source)||source.length>MAX_BYTES||source.length<45||
    !source.subarray(0,8).equals(SIGNATURE))throw new UnsafeImageError();
  let offset=8,width=0,height=0,channels=0,seenHeader=false,seenEnd=false;
  let seenData=false,afterData=false;const parts:Buffer[]=[];
  while(offset<source.length){
   if(offset+12>source.length)throw new UnsafeImageError();
   const n=source.readUInt32BE(offset);
   if(n>MAX_BYTES||offset+12+n>source.length)throw new UnsafeImageError();
   const tag=source.toString("ascii",offset+4,offset+8);
   if(!/^[A-Za-z]{4}$/.test(tag)||["acTL","fcTL","fdAT"].includes(tag))throw new UnsafeImageError();
   const raw=source.subarray(offset+4,offset+8+n);
   if(crc(raw)!==source.readUInt32BE(offset+8+n))throw new UnsafeImageError();
   const value=source.subarray(offset+8,offset+8+n);
   offset+=12+n;
   if(!seenHeader&&tag!=="IHDR")throw new UnsafeImageError();
   if(tag==="IHDR"){
    if(seenHeader||n!==13)throw new UnsafeImageError();
    width=value.readUInt32BE(0);height=value.readUInt32BE(4);
    channels=value[9]===6?4:value[9]===2?3:0;
    if(!width||!height||width>MAX_SIDE||height>MAX_SIDE||
      width*height>MAX_PIXELS||value[8]!==8||!channels||
      value[10]!==0||value[11]!==0||value[12]!==0)throw new UnsafeImageError();
    seenHeader=true;
   }else if(tag==="IDAT"){
    if(afterData||seenEnd||!seenHeader)throw new UnsafeImageError();
    parts.push(value);seenData=true;
   }else if(tag==="IEND"){
    if(n!==0||!seenData||seenEnd||offset!==source.length)throw new UnsafeImageError();
    seenEnd=true;
   }else {
    if(seenData)afterData=true;
    // Unknown CRITICAL chunks are not safe to reinterpret. Ancillary metadata
    // (including eXIf/tEXt/iCCP) is intentionally discarded in the derivative.
    if(tag[0]===tag[0].toUpperCase()||seenEnd)throw new UnsafeImageError();
   }
  }
  if(!seenEnd||!seenData)throw new UnsafeImageError();
  const stride=width*channels,expected=(stride+1)*height;
  const raw=inflateSync(Buffer.concat(parts),{maxOutputLength:expected+1});
  if(raw.length!==expected)throw new UnsafeImageError();
  const pixels=unfilter(raw,width,height,channels);
  const normal=Buffer.alloc(expected);
  for(let y=0;y<height;y++)pixels.copy(normal,y*(stride+1)+1,y*stride,(y+1)*stride);
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;ihdr[9]=channels===4?6:2;
  const bytes=Buffer.concat([SIGNATURE,chunk("IHDR",ihdr),
    chunk("IDAT",deflateSync(normal,{level:6})),chunk("IEND",Buffer.alloc(0))]);
  if(bytes.length>MAX_BYTES)throw new UnsafeImageError();
  return{bytes,width,height,shaInputBytes:source.length};
 }catch{throw new UnsafeImageError();}
}
export function makeSyntheticPng(width=1,height=1):Buffer{
 if(width<1||height<1||width*height>64)throw new UnsafeImageError();
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const rows=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*(width*4+1)+1+x*4;rows[i]=140;rows[i+1]=90;rows[i+2]=180;rows[i+3]=255;
 }
 return Buffer.concat([SIGNATURE,chunk("IHDR",ihdr),chunk("IDAT",deflateSync(rows)),chunk("IEND",Buffer.alloc(0))]);
}
export function addSyntheticMetadata(image:Buffer):Buffer{
 if(!image.subarray(0,8).equals(SIGNATURE))throw new UnsafeImageError();
 return Buffer.concat([image.subarray(0,33),chunk("eXIf",Buffer.from("GPSLatitude=00;SyntheticOnly")),
 image.subarray(33)]);
}
