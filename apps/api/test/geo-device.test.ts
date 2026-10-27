import test from "node:test";
import assert from "node:assert/strict";
import {requestDeviceCoordinates} from "../../web/src/registration/geo-device.js";

test("native Telegram coordinates are used without waking browser GPS",async()=>{
 const controller=new AbortController();let browserCalled=false;
 const coords=await requestDeviceCoordinates({
  native:{isInited:true,isLocationAvailable:true,init:()=>{},getLocation:cb=>cb({latitude:45.03,longitude:38.97})},
  browser:{getCurrentPosition:()=>{browserCalled=true;}}
 },controller.signal);
 assert.deepEqual(coords,{lat:45.03,lon:38.97});
 assert.equal(browserCalled,false);
});

test("native initialization waits until Telegram reports availability",async()=>{
 const controller=new AbortController();let called=false;
 const coords=await requestDeviceCoordinates({
  native:{isInited:false,isLocationAvailable:true,init:cb=>cb(),getLocation:cb=>{called=true;cb({latitude:0,longitude:0});}}
 },controller.signal);
 assert.deepEqual(coords,{lat:0,lon:0});assert.equal(called,true);
});

test("unavailable native location falls back to browser GPS",async()=>{
 const controller=new AbortController();
 const coords=await requestDeviceCoordinates({
  native:{isInited:true,isLocationAvailable:false,init:()=>{},getLocation:()=>{throw new Error("wrong path");}},
  browser:{getCurrentPosition:success=>success({coords:{latitude:51.5,longitude:-0.12}} as GeolocationPosition)}
 },controller.signal);
 assert.deepEqual(coords,{lat:51.5,lon:-0.12});
});

test("explicit native denial must not silently request browser permission",async()=>{
 const controller=new AbortController();let called=false;
 await assert.rejects(()=>requestDeviceCoordinates({
  native:{isInited:true,isLocationAvailable:true,init:()=>{},getLocation:cb=>cb(null)},
  browser:{getCurrentPosition:()=>{called=true;}}
 },controller.signal),/location_denied/);
 assert.equal(called,false);
});

test("stale location callbacks cannot settle after cancellation",async()=>{
 const controller=new AbortController();
 let complete:((v:{latitude:number;longitude:number}|null)=>void)|undefined;
 const result=requestDeviceCoordinates({
  native:{isInited:true,isLocationAvailable:true,init:()=>{},getLocation:cb=>{complete=cb;}}
 },controller.signal);
 controller.abort();complete?.({latitude:40,longitude:40});
 await assert.rejects(result,/location_cancelled/);
});

test("invalid coordinate payload is rejected",async()=>{
 const controller=new AbortController();
 await assert.rejects(()=>requestDeviceCoordinates({
  native:{isInited:true,isLocationAvailable:true,init:()=>{},getLocation:cb=>cb({latitude:999,longitude:20})}
 },controller.signal),/location_invalid/);
});
