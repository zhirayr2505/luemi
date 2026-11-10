/** Build-time vendoring of Telegram's published Web App bridge.
 * The phone should never have to contact telegram.org in addition to LUEMI.
 * This script runs only during the build and never handles initData or tokens.
 */
import {writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";

const endpoint="https://telegram.org/js/telegram-web-app.js?65";
const output=new URL("../apps/web/public/telegram-web-app.js",import.meta.url);

async function download(){
 const response=await fetch(endpoint,{
  signal:AbortSignal.timeout(15000),
  headers:{"Accept":"application/javascript,text/javascript,*/*"}
 });
 if(!response.ok)throw new Error("Telegram SDK download HTTP "+response.status);
 const buffer=Buffer.from(await response.arrayBuffer());
 if(buffer.byteLength<3000||buffer.byteLength>400000)
  throw new Error("Telegram SDK response outside expected size limits");
 const content=buffer.toString("utf8");
 if(/<!doctype\s+html|<html/i.test(content.slice(0,600))||
    !content.includes("Telegram")||!content.includes("WebApp"))
  throw new Error("Telegram SDK invalid upstream response");
 await mkdir(new URL("../apps/web/public/",import.meta.url),{recursive:true});
 await writeFile(output,buffer);
 process.stdout.write("Vendored Telegram WebApp SDK ("+buffer.byteLength+
  " bytes, sha256 "+createHash("sha256").update(buffer).digest("hex").slice(0,16)+")\n");
}

let failed;
for(let attempt=0;attempt<2;attempt++){
 try{await download();failed=null;break;}catch(error){
  failed=error;
  if(attempt===0)await new Promise(resolve=>setTimeout(resolve,800));
 }
}
if(failed)throw new Error("Unable to vendor official Telegram WebApp SDK: "+
 (failed instanceof Error?failed.message:"download failure"));
