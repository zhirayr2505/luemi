import {useEffect,useState} from "react";
import {RealChats} from "./RealChats";
import {createDemoChatTransport} from "./demo-transport";

type Props={
 onExit:()=>void;
 onOpenProfile:()=>void;
 profileOpen:boolean;
 onThreadChange:(open:boolean)=>void;
 registerThreadBack:(handler:(()=>void)|null)=>void;
};

export default function DemoChatSurface({onExit,onOpenProfile,profileOpen,onThreadChange,registerThreadBack}:Props){
 const [session]=useState(()=>createDemoChatTransport({interactive:true,peerPhotoUrl:"/api/v2/qa/portraits/karina/1.webp"}));
 useEffect(()=>()=>session.dispose(),[session]);
 return <RealChats transport={session.transport} onExitDemo={onExit}
  onOpenProfile={onOpenProfile} profileOpen={profileOpen} onThreadChange={onThreadChange} registerThreadBack={registerThreadBack}/>;
}
