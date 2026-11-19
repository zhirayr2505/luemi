// Exercise the public input surface. The card scroller starts at zero in both
// profile states, so writing scrollTop cannot open or close the header.
export async function setPremiumProfileState(page,profile,state){
 if(await profile.getAttribute("data-morph-state")===state)return;
 if(state==="expanded")await profile.locator(".owner-profile-scroll").evaluate(list=>{list.scrollTop=0;});
 const rail=await profile.locator(".owner-profile-tabs").boundingBox();
 if(!rail)throw new Error("Profile tab rail is missing");
 await page.mouse.move(rail.x+rail.width/2,rail.y+rail.height/2);
 await page.mouse.wheel(0,state==="compact"?240:-100);
 await profile.locator("xpath=self::*[@data-morph-state='"+state+"']").waitFor({state:"visible",timeout:5000});
}
