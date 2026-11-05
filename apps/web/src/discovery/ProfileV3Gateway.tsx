import {memo} from "react";
import type {ComponentProps} from "react";
import {ProfileMaster as ProfileV3} from "./ProfileMasterV3";

/** The approved V3 is the only production profile renderer. Keeping the old
 * URL-selectable renderer in this gateway allowed stale Telegram links to
 * reactivate retired chrome and motion code. */
type ProfileProps=ComponentProps<typeof ProfileV3>;
export const ProfileMaster=memo(function ProfileMaster(props:ProfileProps){
 return <ProfileV3 {...props}/>;
});
export type {ProfileRouteMotionHandle} from "./ProfileMasterV3";
