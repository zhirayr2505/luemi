import {useEffect,useState} from "react";
import {RealChats} from "./RealChats";
import {createDemoChatTransport} from "./demo-transport";
import {demoPeople} from "../discovery/demo-people";
import type {DemoPerson} from "../discovery/model";

const demoPeer:DemoPerson={...demoPeople[0],name:"Алина"};

type Props={
 onExit:()=>void;
 onOpenProfile:(peer:DemoPerson)=>void;
 profileOpen:boolean;
 onThreadChange:(open:boolean)=>void;
 registerThreadBack:(handler:(()=>void)|null)=>void;
};

export default function DemoChatSurface({onExit,onOpenProfile,profileOpen,onThreadChange,registerThreadBack}:Props){
 const [session]=useState(()=>createDemoChatTransport({interactive:true,peerPhotoUrl:demoPeer.photos[0]?.src??null}));
 useEffect(()=>()=>session.dispose(),[session]);
 return <RealChats transport={session.transport} onExitDemo={onExit}
  onOpenProfile={()=>onOpenProfile(demoPeer)} profileOpen={profileOpen} onThreadChange={onThreadChange} registerThreadBack={registerThreadBack}/>;
}
