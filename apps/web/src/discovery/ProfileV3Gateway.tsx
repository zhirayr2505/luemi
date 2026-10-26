import {memo} from "react";
import type {ComponentProps} from "react";
import {ProfileMaster as ProfileA2} from "./ProfileMorphA2";
import {ProfileMaster as ProfileV3} from "./ProfileMasterV3";

/** The accepted V3 is the normal profile on every origin. The old A2 remains
 * available only through an explicit diagnostic ?profileV3=0 URL. One profile
 * renderer mounts per route, so their motion writers never compete. */
const v3Enabled=()=>{
 if(typeof window==="undefined")return true;
 const value=new URLSearchParams(window.location.search).get("profileV3");
 return value!=="0";
};
export const ProfileMaster=memo(function ProfileMaster(props:ComponentProps<typeof ProfileA2>){
 return v3Enabled()?<ProfileV3 {...props}/>:<ProfileA2 {...props}/>;
});
export type {ProfileRouteMotionHandle} from "./ProfileMasterV3";
