import {memo} from "react";
import type {ComponentProps} from "react";
import {ProfileMaster as ProfileA2} from "./ProfileMorphA2";
import {ProfileMaster as ProfileV3} from "./ProfileMasterV3";

/** Device-only release gate:
 * - stage01 automatically displays V3 when launched via Telegram bot /start/menu;
 * - production remains on A2 unless a deliberate ?profileV3=1 test URL is used;
 * - ?profileV3=0 always forces the old renderer for safe diagnosis.
 * Exactly ONE renderer mounts per route; no conflicting A2/V3 motion writers.
 * Must NOT remove this gate until physical Galaxy A55 acceptance. */
const v3Enabled=()=>{
 if(typeof window==="undefined")return false;
 const value=new URLSearchParams(window.location.search).get("profileV3");
 if(value==="0")return false;
 return value==="1"||window.location.hostname==="luemi-stage01.onrender.com";
};
export const ProfileMaster=memo(function ProfileMaster(props:ComponentProps<typeof ProfileA2>){
 return v3Enabled()?<ProfileV3 {...props}/>:<ProfileA2 {...props}/>;
});
export type {ProfileRouteMotionHandle} from "./ProfileMasterV3";
