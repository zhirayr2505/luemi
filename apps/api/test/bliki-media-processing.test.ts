import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Readable} from "node:stream";
import test from "node:test";
import sharp from "sharp";
import {BlikiMediaError,blikiMediaPipelineVersion,processBlikiUpload} from "../src/bliki/bliki-media-processing.js";

const ffmpeg=createRequire(import.meta.url)("ffmpeg-static") as string;
async function makeVideo(seconds:number):Promise<{bytes:Buffer;cleanup:()=>Promise<void>}>{
  const dir=await mkdtemp(join(tmpdir(),"bliki-test-"));const file=join(dir,"video.mp4");
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(ffmpeg,["-nostdin","-hide_banner","-loglevel","error","-y",
      "-f","lavfi","-i",`color=c=purple:s=160x284:d=${seconds}`,
      "-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart",file],{stdio:"ignore"});
    child.once("error",reject);child.once("close",code=>code===0?resolve():reject(new Error("fixture_failed")));
  });
  return{bytes:await readFile(file),cleanup:()=>rm(dir,{recursive:true,force:true})};
}

test("sanitizes and bounds a real decoded image",async()=>{
  const input=await sharp({create:{width:320,height:480,channels:3,background:"#7e57a0"}})
    .withMetadata({exif:{IFD0:{Artist:"private"}}}).jpeg().toBuffer();
  const result=await processBlikiUpload(Readable.from(input),input.length,"image","image/jpeg");
  try{
    assert.ok(result.size>0&&result.size<=25*1024*1024);
    assert.match(result.sha256,/^[a-f0-9]{64}$/);
    const metadata=await sharp(result.path).metadata();
    assert.equal(metadata.width,320);assert.equal(metadata.height,480);
    assert.equal(metadata.exif,undefined);
  }finally{await result.cleanup();}
});

test("decodes and transcodes a valid MP4 to a final bounded artifact",async()=>{
  const fixture=await makeVideo(1);
  try{
    const result=await processBlikiUpload(Readable.from(fixture.bytes),fixture.bytes.length,"video","video/mp4");
    try{assert.ok(result.durationMs&&result.durationMs<=15000);assert.ok(result.size>0);}
    finally{await result.cleanup();}
  }finally{await fixture.cleanup();}
});

test("rejects a decoded video longer than 15 seconds",async()=>{
  const fixture=await makeVideo(16);
  try{
    await assert.rejects(()=>processBlikiUpload(Readable.from(fixture.bytes),fixture.bytes.length,"video","video/mp4"),
      (error:unknown)=>error instanceof BlikiMediaError&&error.code==="video_too_long");
  }finally{await fixture.cleanup();}
});

test("bundled ffmpeg and ffprobe are executable",async()=>{
  const versions=await blikiMediaPipelineVersion();
  assert.match(versions.ffmpeg,/^ffmpeg version /);assert.match(versions.ffprobe,/^ffprobe version /);
});
