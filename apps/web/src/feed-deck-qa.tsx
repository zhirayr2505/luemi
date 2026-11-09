/** Developer-only fixture, not imported by the production index. */
import React from "react";
import {createRoot} from "react-dom/client";
import {newDraft} from "./registration/model";
import {DemoFeedSandbox} from "./discovery/DemoFeedSandbox";
import "./ui/luemi-v5.css";
import "./styles.css";
import "./discovery/discovery.css";
import "./discovery/feed-v2.css";
import "./discovery/real-discovery.css";
import "./discovery/deck-v3.css";

const draft={...newDraft("QA"),city:"Ереван",country:"Армения",countryCode:"am"};
createRoot(document.getElementById("root")!).render(
 <div className="luemi-shell">
  <main className="real-discovery-home discovery-app" data-profile-renderer="android"
   style={{position:"relative",height:"100%",width:"100%"}}>
   <section className="discovery-page" aria-label="Лента"
    style={{position:"absolute",top:110,bottom:65,left:0,right:0,display:"flex",minHeight:0}}>
    <DemoFeedSandbox draft={draft} active onExit={()=>{}} onOpenProfile={()=>{}}/>
   </section>
  </main>
 </div>
);
