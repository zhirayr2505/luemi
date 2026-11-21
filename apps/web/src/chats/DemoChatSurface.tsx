import {useEffect,useState} from "react";
import {RealChats} from "./RealChats";
import {createDemoChatTransport} from "./demo-transport";

type Props={
 onExit:()=>void;
 onThreadChange:(open:boolean)=>void;
 registerThreadBack:(handler:(()=>void)|null)=>void;
};

export default function DemoChatSurface({onExit,onThreadChange,registerThreadBack}:Props){
 const [session]=useState(()=>createDemoChatTransport({interactive:true}));
 useEffect(()=>()=>session.dispose(),[session]);
 return <RealChats transport={session.transport} onExitDemo={onExit}
  onThreadChange={onThreadChange} registerThreadBack={registerThreadBack}/>;
}
