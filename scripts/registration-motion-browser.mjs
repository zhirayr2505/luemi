import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const root="http://127.0.0.1:5173/registration-motion-qa.html";
const out="qa-artifacts/registration-motion";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:412,height:915},
  deviceScaleFactor:2.5,isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0 Mobile Safari/537.36"});
 const page=await context.newPage();
 const failures=[];
 page.on("pageerror",error=>failures.push(error.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith("/geo/search")){
   const query=url.searchParams.get("q")?.toLocaleLowerCase("ru")??"";
   const results=query.includes("армавир")?[
    {id:"offline:ru:armavir",city:"Армавир",country:"Россия",countryCode:"RU",region:"Краснодарский край"},
    {id:"offline:am:armavir",city:"Армавир",country:"Армения",countryCode:"AM"}]:
    [{id:"qa:moscow",city:"Москва",country:"Россия",countryCode:"RU"}];
   return route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({results,coverage:"world"})});
  }
  return route.fulfill({status:404,contentType:"application/json",body:"{}"});
 });
 await page.goto(root,{waitUntil:"domcontentloaded"});
 const screenshot=async(label)=>page.screenshot({path:out+"/"+label+".png"});
 const stage=async(id)=>{
  await page.waitForFunction(expected=>{
   const d=document.querySelector(".v2-device");
   return d?.getAttribute("data-screen")===expected &&
    d?.getAttribute("data-step-moving")!=="true";
  },id,{timeout:6000});
  assert.equal(await page.locator(".v2-body").count(),1,id+" should have one body");
  assert.equal(await page.locator(".v2-stage-heading").count(),1,id+" should have one heading");
  await screenshot(id);
 };
 const next=async(id)=>{
  // Confirming an editor keeps it above the closing IME. Only tap Continue
  // once the same button has switched back from the circular checkmark.
  const button=page.getByRole("button",{name:"Продолжить"});
  await button.waitFor({timeout:2500});
  await button.click();
  // A real visible loading indicator replaces the arrow while the stage moves.
  assert.equal(await button.getAttribute("aria-busy"),"true","pending transition must expose spinner");
  await stage(id);
  assert.equal(await page.locator(".v2-next-spinner").count(),0,"spinner must settle");
 };
 await stage("identity");
 await page.getByPlaceholder("Как тебя зовут?").fill("Артём");
 await page.getByRole("button",{name:"Подтвердить поле"}).click();
 await next("birthday");
 await page.getByPlaceholder("ДД.ММ.ГГГГ").fill("12.05.1998");
 // A complete eight-digit birthday automatically dismisses the active editor,
 // but deliberately does not navigate to the next stage.
 await page.locator(".dob-focus-shell.is-focused").waitFor({state:"hidden",timeout:2500});
 assert.equal(await page.locator(".v2-device").getAttribute("data-screen"),"birthday");
 await page.getByRole("button",{name:"Мужчина"}).click();
 const genderCardHeight=await page.locator(".dob-step .glass-choice").first().evaluate(el=>el.getBoundingClientRect().height);
 assert.ok(genderCardHeight<=51,"gender cards must place icon beside label without tall empty space");
 await page.getByRole("checkbox").check();
 await next("location");
 await page.getByRole("button",{name:"Выбрать город"}).click();
 await page.getByPlaceholder("Название города").fill("Армавир");
 const armavir=page.getByRole("option",{name:/Армавир/});
 await armavir.first().waitFor({timeout:6000});
 assert.equal(await armavir.count(),2,"search must show both Russia and Armenia Armavir");
 assert.ok(await page.getByRole("option",{name:/Армавир, Россия, Краснодарский край/}).count()>0);
 assert.ok(await page.getByRole("option",{name:/Армавир, Армения/}).count()>0);
 const cityInput=await page.getByPlaceholder("Название города").boundingBox();
 const cityResults=await page.locator(".geo-city-suggestions").boundingBox();
 assert.ok(cityInput&&cityResults&&cityResults.y>=cityInput.y+cityInput.height-2,
   "suggestions must expand below the input, never behind the top Telegram header");
 assert.ok(cityResults.y<page.viewportSize().height-260,"search results remain visible over mobile keyboard");
 await page.getByRole("option",{name:/Армавир, Россия, Краснодарский край/}).click();
 assert.ok((await page.locator(".geo-liquid-city").innerText()).includes("Армавир"));
 await page.getByRole("button",{name:"Изменить город"}).click();
 await page.getByPlaceholder("Название города").fill("Москва");
 await page.getByRole("option",{name:/Москва/}).first().click();
 // The three modes must keep one shared card without displacing the footer.
 const panel=page.locator(".geo-liquid-mode-panel");
 const originalRect=await panel.boundingBox();
 const cityHeight=await page.locator(".geo-liquid-city").evaluate(el=>el.getBoundingClientRect().height);
 assert.ok(cityHeight<=60,"city card should fit the city and country without wasted height");
 assert.ok(originalRect&&originalRect.height<=89,"shared mode card should use only the space its content needs");
 await page.getByRole("button",{name:"Мой город"}).click();
 assert.equal(await page.getByRole("button",{name:"Мой город"}).getAttribute("aria-pressed"),"true","city search scope is selected");
 for(const mode of ["Весь мир","Рядом","Мой город"]){
  await page.getByRole("button",{name:mode,exact:true}).click();
  const rect=await panel.boundingBox();
  assert.ok(rect&&originalRect);
  assert.ok(Math.abs(rect.height-originalRect.height)<1,"mode "+mode+" must preserve card height");
  assert.ok(Math.abs(rect.y-originalRect.y)<1,"mode "+mode+" must not move the card vertically");
 }
 await page.getByRole("button",{name:"Рядом",exact:true}).click();
 assert.equal(await page.getByRole("slider",{name:"Радиус поиска, километры"}).count(),0,
  "no more manual radius controls");
 assert.equal(await page.getByText("Ближайшие сначала").count(),1,
  "nearby recommends nearest cities automatically");
 assert.ok((await page.locator(".geo-liquid-mode-panel").innerText()).includes("от ближних к дальним"));
 await page.getByRole("button",{name:"Мой город"}).click();
 await next("intent");
 const ageHeight=await page.locator(".age-range").evaluate(el=>el.getBoundingClientRect().height);
 assert.ok(ageHeight<=98,"age selection panel should not waste space above or below the rail");
 const ageGeometry=await page.locator(".double-age-range").evaluate(el=>{
  const track=el.querySelector(".double-range-track")?.getBoundingClientRect();
  const input=el.querySelector(".range-min")?.getBoundingClientRect();
  if(!track||!input)return null;
  return {offset:Math.abs((track.y+track.height/2)-(input.y+input.height/2)),
   left:track.left-input.left,right:input.right-track.right,hit:input.height};
 });
 assert.ok(ageGeometry,"age slider track and range input must exist");
 assert.ok(ageGeometry.offset<=.6,"age slider grips must sit exactly on the visible track centre");
 assert.ok(Math.abs(ageGeometry.left-10)<1&&Math.abs(ageGeometry.right-10)<1,
  "both age thumb endpoints must match the visual 10px rail inset");
 assert.ok(ageGeometry.hit>=34,"compact rail must not shrink the native touch target");
 await page.getByRole("button",{name:"Женщин"}).click();
 // Undecided is already selected on first entry until the user changes it.
 assert.equal(await page.getByRole("button",{name:"Пока не определился"}).getAttribute("aria-pressed"),"true",
   "registration must preselect the gender-aware undecided goal");
 await page.getByRole("button",{name:"Серьёзные отношения"}).click();
 const goalHeight=await page.getByRole("button",{name:"Серьёзные отношения"}).evaluate(el=>el.getBoundingClientRect().height);
 assert.ok(goalHeight<=60,"goal cards should be genuinely compact horizontal rows");
 assert.equal(await page.locator(".v2-goal-choice").count(),13,"all 13 goals remain available");
 const loveIcon=await page.getByRole("button",{name:"Найти любовь"}).locator(".v2-goal-icon svg").innerHTML();
 const relationshipIcon=await page.getByRole("button",{name:"Отношения",exact:true}).locator(".v2-goal-icon svg").innerHTML();
 assert.notEqual(loveIcon,relationshipIcon,"love and relationships must never share identical icons");
 await page.setViewportSize({width:360,height:780});
 const compactOverflow=await page.locator(".v2-goal-choice").evaluateAll(nodes=>
  nodes.some(node=>node.scrollWidth>node.clientWidth+1));
 assert.equal(compactOverflow,false,"goal labels must not clip or overflow on narrow phones");
 await page.setViewportSize({width:412,height:915});
 // Biography and interests return before photos; languages remain optional.
 await next("about");
 await page.getByPlaceholder("Что тебя радует? Чем любишь заниматься?").fill("Люблю музыку и прогулки по городу.");
 await page.getByRole("button",{name:"Подтвердить поле"}).click();
 assert.equal(await page.locator(".v2-sticky-interests.is-visible").count(),0,
  "empty selected-interests section is not shown");
 assert.ok(await page.locator(".v2-sticky-interests").evaluate(node=>node.getBoundingClientRect().height)<3,
  "empty sticky area consumes no extra vertical space");
 await page.locator(".interest-choices button").first().click();
 await page.locator(".v2-sticky-interests.is-visible").waitFor();
 const remove=page.getByRole("button",{name:/Удалить интерес/}).first();
 assert.equal(await remove.locator(".v2-selected-interest-close svg").count(),1,
  "the selected-interest chip must show an X, not the old checkmark");
 await remove.click();
 await page.waitForFunction(()=>{
  const box=document.querySelector(".v2-sticky-interests");
  return box&&!box.classList.contains("is-visible")&&box.getBoundingClientRect().height<3;
 },null,{timeout:1800});
 assert.equal(await page.getByRole("button",{name:/Удалить интерес/}).count(),0);
 await page.locator(".interest-choices button").first().click();
 await page.locator(".v2-sticky-interests.is-visible").waitFor();
 assert.equal(await page.locator(".v2-about-interest-heading").count(),1);
 assert.equal(await page.locator(".v2-sticky-interests").count(),1,"the ribbon is attached to the single sticky heading");
 assert.equal(await page.locator(".v2-stage-heading .v2-sticky-interests").count(),1);
 assert.equal(await page.locator(".interest-selected-group").count(),0,"the retired multirow box must be gone");
 // Fill enough chips to overflow the narrow screen; their count does not
 // change the sticky region height and dragging remains a native touch scroll.
 for(let i=1;i<=8;i++)await page.locator(".interest-choices button").nth(i).click();
 const strip=page.locator(".v2-sticky-interest-strip");
 const dimensions=await strip.evaluate(node=>({width:node.clientWidth,total:node.scrollWidth,height:node.clientHeight}));
 assert.ok(dimensions.total>dimensions.width+60,"the selected chips overflow horizontally without wrapping");
 const header=page.locator(".v2-stage-heading");
 const beforeHeader=await header.boundingBox();
 await page.locator(".v2-body").evaluate(node=>node.scrollTop=node.scrollHeight);
 await page.waitForTimeout(70);
 const afterHeader=await header.boundingBox();
 assert.ok(beforeHeader&&afterHeader);
 assert.ok(Math.abs(afterHeader.y-beforeHeader.y)<=24,"the title and interest ribbon remain sticky while the list scrolls");
 const stripBox=await strip.boundingBox();
 assert.ok(stripBox,"the sticky selected chips must remain visible at the scrolled position");
 const client=await page.context().newCDPSession(page);
 try{
  const y=stripBox.y+stripBox.height/2;
  const x0=stripBox.x+stripBox.width-24;
  const x1=stripBox.x+24;
  await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:1,x:x0,y}]});
  for(let i=1;i<=12;i++){
   await client.send("Input.dispatchTouchEvent",{type:"touchMove",
    touchPoints:[{id:1,x:x0+(x1-x0)*i/12,y}]});
   await page.waitForTimeout(14);
  }
  await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await client.detach()}
 const horizontalOffset=await strip.evaluate(node=>node.scrollLeft);
 assert.ok(horizontalOffset>18,"one-finger horizontal swipe scrolls the ribbon in Android Chromium");
 await strip.evaluate(node=>node.scrollLeft=0);
 await page.locator(".v2-body").evaluate(node=>node.scrollTop=0);
 // The expanded catalog uses the same keyboard-stable focus dock. A new
 // interest far outside the old twelve-tag list must be searchable and saved.
 await page.getByPlaceholder("Найти интерес…").fill("Космология");
 await page.locator(".interest-focus-shell.is-focused").waitFor({state:"visible"});
 await page.getByRole("button",{name:"Подтвердить поле"}).click();
 await page.locator(".interest-focus-shell.is-focused").waitFor({state:"hidden",timeout:3500});
 await page.locator(".interest-choices button").filter({hasText:"Космология"}).click();
 assert.ok(await page.locator(".v2-sticky-interest-strip").getByText("Космология").count()>0,
  "new color-tagged interests must remain selected");
 await page.evaluate(()=>{
  const d=document.querySelector(".v2-device");
  const log=[];
  const trace=()=>log.push({
   screen:d?.getAttribute("data-screen"),
   bodies:d?.querySelectorAll(".v2-body").length,
   headings:d?.querySelectorAll(".v2-stage-heading").length
  });
  const ob=new MutationObserver(trace);
  ob.observe(d,{subtree:true,childList:true,attributes:true});
  window.__stopStepTrace=()=>{ob.disconnect();return log};
 });
 await next("photos");
 const events=await page.evaluate(()=>window.__stopStepTrace());
 assert(events.length>0,"transition should generate DOM mutations");
 assert(events.every(event=>event.bodies<=1&&event.headings<=1),
  "No overlapping old/new stage content trees are allowed");
 assert.equal(await page.locator(".optional-profile-toggle").count(),0,
  "Nonessential profile details must not interrupt signup");
 // Telegram back returns to the biography stage.
 await page.evaluate(()=>window.__luemiQABack?.());
 await stage("about");
 await next("photos");
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9u/JqYQAAAAASUVORK5CYII=","base64");
 await page.locator('input.native-photo-input[type="file"]').setInputFiles([0,1,2].map((i)=>({
  name:"synthetic-"+i+".png",mimeType:"image/png",
  buffer:Buffer.concat([png,Buffer.from([i])])
 })));
 assert.equal(await page.locator(".mosaic img").count(),3,"three photos are ready");
 assert.equal(await page.locator(".photo-make-main").count(),0,"crown action removed");
 assert.equal(await page.locator(".primary-photo").count(),1,"first photo is always main");
 const before=await page.locator(".mosaic-slot>img").evaluateAll(items=>items.map(x=>x.src));
 const handle=await page.locator(".photo-drag-handle").first().boundingBox();
 const target=await page.locator('[data-photo-slot="1"]').boundingBox();
 assert.ok(handle&&target,"the handle and target tile must have geometry");
 // Android WebView touch, not just a desktop mouse pretending to be mobile.
 const cdp=await page.context().newCDPSession(page);
 const start={x:handle.x+handle.width/2,y:handle.y+handle.height/2};
 const end={x:target.x+target.width/2,y:target.y+target.height/2};
 try{
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...start,id:1}]});
  for(let i=1;i<=12;i++){
   const x=start.x+(end.x-start.x)*i/12,y=start.y+(end.y-start.y)*i/12;
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y,id:1}]});
   await page.waitForTimeout(14);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await cdp.detach()}
 const after=await page.locator(".mosaic-slot>img").evaluateAll(items=>items.map(x=>x.src));
 assert.notDeepEqual(after,before,"handle touch drag reorders the tiles");
 assert.equal(after[1],before[0],"former main photo moves to second slot");
 await page.getByRole("button",{name:"Посмотреть анкету"}).click();
 await stage("review");
 assert.equal(await page.locator(".v2-showcase-track img").count(),3,"review shows the selected photos");
 assert.equal(await page.getByText("Люблю музыку и прогулки по городу.").count(),1);
 await page.getByRole("button",{name:"Редактировать"}).click();
 await stage("photos");
 await page.evaluate(()=>window.__luemiQABack?.());
 await stage("about");
 await next("photos");
 await page.getByRole("button",{name:"Посмотреть анкету"}).click();
 await stage("review");
 await page.getByRole("button",{name:"Создать анкету"}).click();
 await page.getByTestId("qa-synthetic-complete").waitFor({timeout:6000});
 await screenshot("synthetic-published");
 assert.deepEqual(failures,[],"no browser errors through full signup and review");
 console.log("LUEMI registration browser About, handle drag and review PASS");
}finally{await browser.close();}
