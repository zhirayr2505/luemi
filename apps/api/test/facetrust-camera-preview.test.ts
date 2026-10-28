import test from "node:test";
import assert from "node:assert/strict";
import {CameraPreviewController} from "../../web/src/registration/v2/camera-preview-controller.js";

function makeStream(){
 const track={stopped:0,stop(){this.stopped++}};
 return{stream:{getTracks:()=>[track]},track};
}
test("camera preview stops every real track when Telegram backgrounding closes it",async()=>{
 const ctrl=new CameraPreviewController<ReturnType<typeof makeStream>["stream"]>();
 const {stream,track}=makeStream();
 let attached=0;
 assert.equal(await ctrl.open(async()=>stream,async()=>{attached++}),"preview");
 assert.equal(attached,1);
 ctrl.close();
 assert.equal(track.stopped,1);
});
test("camera permission finishing after unmount never attaches and always releases stream",async()=>{
 const ctrl=new CameraPreviewController<ReturnType<typeof makeStream>["stream"]>();
 let resolveRequest!: (value:ReturnType<typeof makeStream>["stream"])=>void;
 const permission=new Promise<ReturnType<typeof makeStream>["stream"]>(resolve=>{resolveRequest=resolve;});
 let attached=false;
 const active=ctrl.open(()=>permission,async()=>{attached=true});
 ctrl.dispose();
 const {stream,track}=makeStream();
 resolveRequest(stream);
 assert.equal(await active,"cancelled");
 assert.equal(attached,false);
 assert.equal(track.stopped,1);
 assert.equal(await ctrl.open(async()=>stream,async()=>{}),"cancelled");
});
test("fast camera stop while attached play promise is pending cannot mark preview",async()=>{
 const ctrl=new CameraPreviewController<ReturnType<typeof makeStream>["stream"]>();
 const {stream,track}=makeStream();
 let resume!:()=>void;
 const player=new Promise<void>(resolve=>{resume=resolve;});
 const result=ctrl.open(async()=>stream,async()=>player);
 // request(), attach() and await all advance on the microtask queue.
 await Promise.resolve();await Promise.resolve();
 ctrl.close();resume();
 assert.equal(await result,"cancelled");
 assert.ok(track.stopped>=1);
});
test("if camera video fails to play, no capture track remains running",async()=>{
 const ctrl=new CameraPreviewController<ReturnType<typeof makeStream>["stream"]>();
 const {stream,track}=makeStream();
 await assert.rejects(ctrl.open(async()=>stream,async()=>{throw new Error("play_failed")}),/play_failed/);
 assert.equal(track.stopped,1);
});
