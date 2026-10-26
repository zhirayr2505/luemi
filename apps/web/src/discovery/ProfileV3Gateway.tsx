import {memo} from "react";
import type {ComponentProps} from "react";
import {ProfileMaster as ProfileA2} from "./ProfileMorphA2";
import {ProfileMaster as ProfileV3} from "./ProfileMasterV3";

/** Integration gate. Preserve legacy QA and shipped routes until A55 acceptance.
 * V3 is explicitly opt-in via ?profileV3=1 in an isolated test URL.
 * Exactly ONE profile renderer mounts per route; never run A2 and V3 in parallel. */
const v3Enabled=()=>typeof window!=="undefined"&&
 new URLSearchParams(window.location.search).get("profileV3")==="1";
export const ProfileMaster=memo(function ProfileMaster(props:ComponentProps<typeof ProfileA2>){
 return v3Enabled()?<ProfileV3 {...props}/>:<ProfileA2 {...props}/>;
});
export type {ProfileRouteMotionHandle} from "./ProfileMasterV3";
