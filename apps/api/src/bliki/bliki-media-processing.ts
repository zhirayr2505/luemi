import {createHash} from "node:crypto";
import {createReadStream,createWriteStream} from "node:fs";
import {mkdtemp,rm,stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createRequire} from "node:module";
import {spawn} from "node:child_process";
import {pipeline} from "node:stream/promises";
import type {Readable} from "node:stream";
import {path as ffprobePath} from "ffprobe-static";
import sharp from "sharp";
import {BLIKI_LIMITS} from "./bliki-policy.js";

const PROCESS_TIMEOUT_MS=60_000;
const MAX_PROBE_OUTPUT=256*1024;
const IMAGE_PIXELS=32_000_000;
const ffmpegPath=createRequire(import.meta.url)("ffmpeg-static") as string|null;

export class BlikiMediaError extends Error {
  constructor(readonly code:string,readonly permanent=true){super(code);}
}

export type ProcessedBlikiMedia={
  path:string;
  size:number;
  sha256:string;
  mimeType:"image/jpeg"|"image/png"|"image/webp"|"video/mp4";
  durationMs:number|null;
  cleanup:()=>Promise<void>;
};

async function run(binary:string,args:string[],timeoutMs=PROCESS_TIMEOUT_MS):Promise<{stdout:string;stderr:string}>{
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{stdio:["ignore","pipe","pipe"],windowsHide:true});
    let stdout="",stderr="",overflow=false,settled=false;
    const timer=setTimeout(()=>{
      child.kill("SIGKILL");
      finish(new BlikiMediaError("media_processing_timeout",false));
    },timeoutMs);
    const append=(current:string,chunk:Buffer)=>{
      const next=current+chunk.toString("utf8");
      if(Buffer.byteLength(next)>MAX_PROBE_OUTPUT){overflow=true;child.kill("SIGKILL");}
      return next;
    };
    child.stdout.on("data",chunk=>{stdout=append(stdout,chunk);});
    child.stderr.on("data",chunk=>{stderr=append(stderr,chunk);});
    child.once("error",error=>finish(error));
    child.once("close",code=>{
      if(overflow)return finish(new BlikiMediaError("media_tool_output_overflow"));
      if(code!==0)return finish(new BlikiMediaError("invalid_media"));
      finish(undefined,{stdout,stderr});
    });
    function finish(error?:unknown,value?:{stdout:string;stderr:string}){
      if(settled)return;settled=true;clearTimeout(timer);
      if(error)reject(error);else resolve(value!);
    }
  });
}

async function hashFile(path:string):Promise<{size:number;sha256:string}>{
  const hash=createHash("sha256");let size=0;
  for await(const chunk of createReadStream(path)){
    const bytes=chunk as Buffer;size+=bytes.length;hash.update(bytes);
  }
  return{size,sha256:hash.digest("hex")};
}

async function receive(stream:Readable,path:string,expected:number,limit:number):Promise<void>{
  if(!Number.isSafeInteger(expected)||expected<1||expected>limit)
    throw new BlikiMediaError("invalid_upload_size");
  let received=0;
  stream.on("data",chunk=>{
    received+=Buffer.byteLength(chunk);
    if(received>expected||received>limit)stream.destroy(new BlikiMediaError("upload_size_mismatch"));
  });
  try{await pipeline(stream,createWriteStream(path,{flags:"wx",mode:0o600}));}
  catch(error){
    if(error instanceof BlikiMediaError)throw error;
    throw new BlikiMediaError("upload_stream_failed",false);
  }
  if(received!==expected)throw new BlikiMediaError("upload_size_mismatch");
}

async function sanitizeImage(input:string,output:string,mime:ProcessedBlikiMedia["mimeType"]):Promise<void>{
  const image=sharp(input,{failOn:"error",limitInputPixels:IMAGE_PIXELS,sequentialRead:true});
  const metadata=await image.metadata();
  if(!metadata.width||!metadata.height||metadata.width<32||metadata.height<32||
    metadata.width*metadata.height>IMAGE_PIXELS||metadata.pages&&metadata.pages!==1)
    throw new BlikiMediaError("invalid_image");
  // Sharp strips EXIF/GPS/ICC metadata by default. Rotation is applied from
  // orientation before the metadata disappears from the sanitized output.
  let normalized=image.rotate().resize({width:2160,height:3840,fit:"inside",withoutEnlargement:true});
  if(mime==="image/jpeg")normalized=normalized.jpeg({quality:90,mozjpeg:true});
  else if(mime==="image/png")normalized=normalized.png({compressionLevel:9,palette:false});
  else if(mime==="image/webp")normalized=normalized.webp({quality:90,effort:4});
  else throw new BlikiMediaError("invalid_image_type");
  await normalized.toFile(output);
}

type Probe={format?:{duration?:string;format_name?:string};streams?:Array<{
  codec_type?:string;codec_name?:string;width?:number;height?:number;duration?:string;
}>};
async function probe(path:string):Promise<{durationMs:number;width:number;height:number}>{
  const result=await run(ffprobePath,["-v","error","-show_entries",
    "format=duration,format_name:stream=codec_type,codec_name,width,height,duration",
    "-of","json",path],20_000);
  let parsed:Probe;
  try{parsed=JSON.parse(result.stdout) as Probe;}catch{throw new BlikiMediaError("invalid_video");}
  const video=parsed.streams?.find(stream=>stream.codec_type==="video");
  const duration=Number(video?.duration??parsed.format?.duration);
  const width=Number(video?.width),height=Number(video?.height);
  if(!Number.isFinite(duration)||duration<=0||duration>15||!Number.isSafeInteger(width)||
    !Number.isSafeInteger(height)||width<32||height<32||width*height>IMAGE_PIXELS)
    throw new BlikiMediaError(duration>15?"video_too_long":"invalid_video");
  return{durationMs:Math.ceil(duration*1000),width,height};
}

async function transcodeVideo(input:string,output:string):Promise<number>{
  if(!ffmpegPath||!ffprobePath)throw new BlikiMediaError("video_pipeline_unavailable",false);
  await probe(input);
  await run(ffmpegPath,["-nostdin","-hide_banner","-loglevel","error","-y","-i",input,
    "-map","0:v:0","-map","0:a:0?","-sn","-dn","-map_metadata","-1","-map_chapters","-1",
    "-vf","scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-c:v","libx264","-preset","veryfast","-profile:v","main","-level","4.0","-pix_fmt","yuv420p",
    "-crf","23","-maxrate","6M","-bufsize","12M","-threads","1",
    "-c:a","aac","-b:a","128k","-ac","2","-ar","48000","-movflags","+faststart",output]);
  const verified=await probe(output);
  if(verified.durationMs>15_000)throw new BlikiMediaError("video_too_long");
  return verified.durationMs;
}

export async function processBlikiUpload(input:Readable,expectedBytes:number,
  mediaKind:"image"|"video",mimeType:ProcessedBlikiMedia["mimeType"]):Promise<ProcessedBlikiMedia>{
  const limit=mediaKind==="image"?BLIKI_LIMITS.photoMaxBytes:BLIKI_LIMITS.videoMaxBytes;
  const directory=await mkdtemp(join(tmpdir(),"luemi-bliki-"));
  const cleanup=()=>rm(directory,{recursive:true,force:true});
  const source=join(directory,"source.bin");
  const output=join(directory,mediaKind==="video"?"processed.mp4":"processed.img");
  try{
    await receive(input,source,expectedBytes,limit);
    let durationMs:number|null=null;
    if(mediaKind==="image")await sanitizeImage(source,output,mimeType);
    else{
      if(mimeType!=="video/mp4")throw new BlikiMediaError("invalid_video_type");
      durationMs=await transcodeVideo(source,output);
    }
    const measured=await stat(output);
    if(!measured.isFile()||measured.size<1||measured.size>limit)
      throw new BlikiMediaError("processed_media_too_large");
    const digest=await hashFile(output);
    return{path:output,size:digest.size,sha256:digest.sha256,mimeType,durationMs,cleanup};
  }catch(error){await cleanup();throw error;}
}

/** Test-only helper: proves the packaged tools can execute without publishing data. */
export async function blikiMediaPipelineVersion():Promise<{ffmpeg:string;ffprobe:string}>{
  if(!ffmpegPath||!ffprobePath)throw new BlikiMediaError("video_pipeline_unavailable",false);
  const [ffmpeg,ffprobe]=await Promise.all([run(ffmpegPath,["-version"],5_000),run(ffprobePath,["-version"],5_000)]);
  return{ffmpeg:ffmpeg.stdout.split("\n")[0]??"",ffprobe:ffprobe.stdout.split("\n")[0]??""};
}
