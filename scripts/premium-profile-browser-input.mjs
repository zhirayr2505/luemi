import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";

async function swipeCards(input,page,cards,deltaY){
 const rect=await cards.boundingBox();
 assert(rect,"The profile card viewport is missing");
 // The expanded sheet extends below the screen. Start inside its visible
 // area and leave room for the swipe before reaching screen chrome.
 const bottom=Math.min(rect.y+rect.height,page.viewportSize().height)-24;
 const x=rect.x+rect.width/2;
 const y=rect.y+Math.min(80,(bottom-rect.y)/2);
 const endY=Math.min(bottom,Math.max(24,y+deltaY));
 const touch=(type,touchPoints)=>input.send("Input.dispatchTouchEvent",{type,touchPoints});
 await touch("touchStart",[{x,y,id:1}]);
 try{
  for(let step=1;step<=10;step++){
   await delay(16);
   await touch("touchMove",[{x,y:y+(endY-y)*step/10,id:1}]);
  }
 }finally{
  await touch("touchEnd",[]);
 }
}

// Each touchEnd closes that gesture, even when the next swipe follows
// immediately. Continuous wheel input can remain in a single scroll burst.
export async function setPremiumProfileState(page,profile,state){
 if(await profile.getAttribute("data-morph-state")===state)return;
 const cards=profile.getByRole("tabpanel");
 const readTop=()=>cards.evaluate(list=>new Promise(resolve=>
  requestAnimationFrame(()=>resolve(list.scrollTop))));
 const input=await page.context().newCDPSession(page);
 try{
  if(state==="expanded"){
   let top=await readTop();
   while(top>.5){
    await swipeCards(input,page,cards,240);
    assert.equal(await profile.getAttribute("data-morph-state"),"compact",
     "The swipe that brings the cards to their top must leave the profile compact");
    const after=await readTop();
    assert(after<top,"A downward touch swipe must scroll the cards toward their top");
    top=after;
   }
  }
  await swipeCards(input,page,cards,state==="compact"?-240:100);
  await profile.locator("xpath=self::*[@data-morph-state='"+state+"']").waitFor({state:"visible",timeout:5000});
 }finally{
  await input.detach();
 }
}
