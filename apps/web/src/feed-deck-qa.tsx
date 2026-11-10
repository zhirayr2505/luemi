/** Developer-only fixture, not imported by the production index. */
import React from "react";
import {createRoot} from "react-dom/client";
import {newDraft} from "./registration/model";
import {DemoFeedSandbox} from "./discovery/DemoFeedSandbox";
import "./ui/luemi-v5.css";
import "./styles.css";
import "./discovery/discovery.css";
import "./discovery/moonstone-discovery.css";
import "./discovery/real-discovery.css";
import "./discovery/deck-v3.css";

const draft={...newDraft("QA"),city:"Ереван",country:"Армения",countryCode:"am"};
createRoot(document.getElementById("root")!).render(
 <div className="luemi-shell">
  <main className="real-discovery-home discovery-app" data-profile-renderer="android" data-feed-visible="true"
   style={{position:"relative",height:"100%",width:"100%"}}>
   <section className="discovery-page" aria-label="Лента"
    style={{position:"absolute",inset:0,display:"flex",minHeight:0}}>
    <DemoFeedSandbox draft={draft} active onExit={()=>{}} onOpenProfile={()=>{}}/>
   </section>
  </main>
 </div>
);
