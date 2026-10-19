import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const base='http://127.0.0.1:4173', results=[], errors=[];
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4173'],{stdio:'pipe'});
server.stdout.on('data',x=>process.stdout.write(x));
server.stderr.on('data',x=>process.stderr.write(x));
await mkdir('qa-shots',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage();
page.setDefaultTimeout(6500);
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console.error: '+m.text())});
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
async function screenshot(name){try{await page.screenshot({path:'qa-shots/'+name+'.png',animations:'disabled'})}catch(e){console.log('SCREENSHOT ERROR',name,String(e))}}
async function step(label,fn){
 try{await fn();results.push({item:label,status:'PASS'});console.log('PASS',label)}
 catch(e){const message=String(e?.stack??e);results.push({item:label,status:'FAIL',reason:message});console.log('FAIL',label,message.slice(0,1600));await screenshot('FAIL-'+label.replace(/[^a-zA-Z0-9_-]/g,'_'))}
}
async function waitFrame(n=2){await page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r))},n)}
async function openAlina(){
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('.slide-pane[data-page="Знакомства"] .profile-name').first().click();
 await page.locator('.profile-detail-root').waitFor({state:'visible'});
}
async function uiState(){
 return page.evaluate(()=>{
 const sc=document.querySelector('.profile-detail-scroll'),photo=document.querySelector('.profile-morph-photo'),compact=document.querySelector('.profile-morph-compact'),tabs=document.querySelector('.profile-tabs-rail');
 return {y:sc?.scrollTop,travel:document.querySelector('.profile-snap-closed')?.offsetTop-document.querySelector('.profile-snap-open')?.offsetTop,photo:photo?.getBoundingClientRect().toJSON(),compact:compact?.getBoundingClientRect().toJSON(),tabs:tabs?.getBoundingClientRect().toJSON()}
 })}
async function setY(y){await page.evaluate(y=>{const e=document.querySelector('.profile-detail-scroll');e.style.scrollSnapType='none';e.scrollTop=y},y);await waitFrame()}
async function select(label){
 await page.getByRole('tab',{name:label,exact:true}).click();
 await page.waitForFunction(label=>[...document.querySelectorAll('.profile-tabs-tab')].some(x=>x.textContent.trim()===label&&x.getAttribute('aria-selected')==='true'),label,{timeout:5500});
}
async function swipe(x0,y0,x1,y1,steps=10){
 const cdp=await context.newCDPSession(page);
 try{
 const point=(x,y)=>[{x:Math.round(x),y:Math.round(y),radiusX:2,radiusY:2,force:1,id:0}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(x0,y0)});
 for(let i=1;i<=steps;i++){const t=i/steps;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(x0+(x1-x0)*t,y0+(y1-y0)*t)});await sleep(18)}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(450);
 } finally{await cdp.detach().catch(()=>{})}
}
async function modeRun(mode){
 const reduced=mode.includes('reduced'),dark=mode.includes('dark');
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 await openAlina();
 await page.evaluate(({dark,reduced})=>{document.documentElement.dataset.luemiTheme=dark?'dark':'light';document.documentElement.dataset.reducedMotion=String(reduced)}, {dark,reduced});
 const state=await uiState(),travel=state.travel;
 assert(Number.isFinite(travel)&&travel>180&&travel<420,'travel invalid: '+travel);
 await step(mode+'-1-ring',async()=>{
  assert(await page.locator('.profile-morph-circle-rim').count()===0,'duplicate rim still in DOM');
  const vals=[];
  for(let pos=0;pos<=travel;pos+=20){
   await setY(Math.min(pos,travel));
   vals.push({pos,y:(await uiState()).y,alpha:parseFloat(await page.locator('.profile-morph-photo').evaluate(e=>getComputedStyle(e,'::after').opacity))});
  }
  await setY(travel);
  const last=await uiState();
  vals.push({pos:travel,y:last.y,alpha:parseFloat(await page.locator('.profile-morph-photo').evaluate(e=>getComputedStyle(e,'::after').opacity))});
  console.log('RING TRACE',mode,JSON.stringify(vals));
  await screenshot(mode+'-1-collapsed-ring');
  assert(vals.every(v=>Number.isFinite(v.alpha)),'rim opacity not numeric');
  assert(vals.filter(v=>v.pos<=travel*.48).every(v=>v.alpha<.08),'rim visible before 50%');
  assert(vals.every((v,i)=>i===0||v.alpha+0.04>=vals[i-1].alpha),'rim opacity decreases');
  assert(vals.at(-1).alpha>.9,'rim does not reach 1');
  assert(Math.abs(last.photo.width-56)<=1&&Math.abs(last.photo.height-56)<=1,'avatar size not 56±1: '+JSON.stringify(last.photo));
 });
 await step(mode+'-2-blank-under-compact',async()=>{
  const tabs=['О себе','Блики','Фото','Аккаунт','Подарки'];
  const scInfo=await page.locator('.profile-detail-scroll').evaluate(e=>({max:e.scrollHeight-e.clientHeight}));
  let overlap=[];
  for(const y of [travel+50,travel+300,scInfo.max]){
   await setY(y);
   for(let i=0;i<tabs.length;i++){
    await select(tabs[i]);
    const v=await page.evaluate(()=>{
     const cap=document.querySelector('.profile-morph-compact')?.getBoundingClientRect(),rail=document.querySelector('.profile-tabs-rail')?.getBoundingClientRect();
     if(!cap||!rail)return {missing:true};
     const top=cap.bottom,bottom=rail.top;
     const candidates=[...document.querySelectorAll('.profile-tabs-stack h3,.profile-tabs-stack p,.profile-tab-card,.profile-collection-empty,.profile-photo-tile,.profile-account-row')]
        .filter(e=>{const r=e.getBoundingClientRect();return r.top<bottom-1&&r.bottom>top+1&&r.width>3}).map(e=>e.className+' '+e.textContent.slice(0,25));
     return {top,bottom,candidates};
    });
    await screenshot(mode+'-2-'+Math.round(y)+'-tab'+i);
    if(v.missing||v.candidates.length)overlap.push({y,tab:tabs[i],...v});
   }
  }
  assert(overlap.length===0,'content in capsule-rail gap: '+JSON.stringify(overlap.slice(0,8)));
 });
 await step(mode+'-3-tabs-height-and-selection',async()=>{
  await setY(travel+150);
  const labs=['О себе','Блики','Фото','Аккаунт','Подарки'],txt=['Коротко','Пока нет бликов','Фотографии','Информация об аккаунте','Здесь будет коллекция подарков'];
  for(let i=0;i<labs.length;i++){
   await select(labs[i]);
   const val=await page.locator('#profile-panel-'+i).innerText();
   assert(val.includes(txt[i]),'panel text missing '+labs[i]);
   await screenshot(mode+'-3-'+i+'-'+labs[i]);
  }
  await select('Блики');
  const y=await page.locator('.profile-detail-scroll').evaluate(e=>e.scrollTop);
  const heights=[];
  const task=select('Аккаунт');
  for(let i=0;i<16;i++){heights.push(await page.locator('.profile-tabs-viewport').evaluate(e=>e.offsetHeight));await sleep(30)}
  await task;
  const y1=await page.locator('.profile-detail-scroll').evaluate(e=>e.scrollTop);
  assert(Math.max(...heights)-Math.min(...heights)<=1,'viewport height changed '+JSON.stringify(heights));
  assert(Math.abs(y1-y)<=1,'vertical scroll changed during horizontal click: '+y+' -> '+y1);
 });
 await step(mode+'-4-glass-indicator',async()=>{
  const exist=await page.locator('.profile-tabs-glass').count();
  assert(exist===1,'glass indicator missing');
  const values=[];
  for(let i=0;i<=10;i++){
   values.push(await page.evaluate(i=>{
     const vp=document.querySelector('.profile-tabs-viewport'),glass=document.querySelector('.profile-tabs-glass');
     vp.style.scrollBehavior='auto';vp.style.scrollSnapType='none';
     vp.scrollLeft=vp.clientWidth*i/10;
     return {x:glass.getBoundingClientRect().x,position:vp.scrollLeft,tab2:document.querySelectorAll('.profile-tabs-tab')[1].getBoundingClientRect().x};
   },i));
   await waitFrame();
   values[values.length-1]=await page.evaluate(()=>({x:document.querySelector('.profile-tabs-glass').getBoundingClientRect().x,position:document.querySelector('.profile-tabs-viewport').scrollLeft,tab2:document.querySelectorAll('.profile-tabs-tab')[1].getBoundingClientRect().x}));
  }
  await screenshot(mode+'-4-glass-sliding');
  console.log('GLASS TRACE',mode,JSON.stringify(values));
  assert(values.every((v,i)=>i===0||v.x>=values[i-1].x-1),'glass x nonmonotonic');
  assert(Math.abs(values.at(-1).x-values.at(-1).tab2)<=2,'glass end x differs from second tab '+JSON.stringify(values.at(-1)));
  await page.locator('.profile-tabs-viewport').evaluate(e=>{e.style.scrollSnapType='';e.style.scrollBehavior=''});
 });
 await step(mode+'-5-native-touch-swipe',async()=>{
  await select('О себе');
  await page.waitForTimeout(250);
  const viewport=await page.locator('.profile-tabs-viewport').boundingBox();
  assert(viewport&&viewport.height>100,'tabs viewport not visible');
  const cy=Math.min(790,Math.max(viewport.y+55,viewport.y+25));
  const before=await page.locator('.profile-tabs-viewport').evaluate(e=>e.scrollLeft);
  await swipe(306,cy,90,cy);
  const after=await page.locator('.profile-tabs-viewport').evaluate(e=>e.scrollLeft);
  await screenshot(mode+'-5-left-swipe');
  assert(after>before+100,'left touch swipe did not move panel: '+before+' to '+after);
  const w=await page.locator('.profile-tabs-viewport').evaluate(e=>e.clientWidth);
  assert(Math.min(after%w,w-after%w)<2,'left snap is off panel: '+after+' width '+w);
  await swipe(95,cy,315,cy);
  const back=await page.locator('.profile-tabs-viewport').evaluate(e=>e.scrollLeft);
  await screenshot(mode+'-5-right-swipe');
  assert(back<after-100,'right touch swipe did not move back');
  assert(Math.min(back%w,w-back%w)<2,'right snap off panel: '+back);
 });
 await step(mode+'-6-fullscreen-viewer',async()=>{
  await select('Фото');
  await page.locator('.profile-photo-tile').first().click();
  const dlg=page.locator('dialog.photo-viewer');
  await dlg.waitFor({state:'visible'});
  const v=await dlg.evaluate(e=>({r:e.getBoundingClientRect().toJSON(),bg:getComputedStyle(e).backgroundColor}));
  assert(Math.abs(v.r.width-393)<2&&Math.abs(v.r.height-852)<2,'viewer not fullscreen '+JSON.stringify(v.r));
  assert(/rgb\(12, 7, 18\)/.test(v.bg),'viewer not dark '+v.bg);
  assert((await page.locator('.pv-counter').innerText()).trim()==='1 / 3','counter initial not 1 / 3');
  await screenshot(mode+'-6-photo-viewer');
  await swipe(319,420,67,420);
  assert((await page.locator('.pv-counter').innerText()).trim()==='2 / 3','photo swipe did not advance to 2 / 3');
  const stage=page.locator('.pv-slide[data-index="1"] .pv-photo-stage');
  const rect=await stage.boundingBox();
  assert(rect,'photo stage missing');
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await page.touchscreen.tap(x,y);await sleep(110);await page.touchscreen.tap(x,y);await sleep(120);
  const scale=await stage.evaluate(e=>Math.hypot(new DOMMatrixReadOnly(getComputedStyle(e).transform).a,new DOMMatrixReadOnly(getComputedStyle(e).transform).b));
  assert(scale>2.2&&scale<2.8,'double-tap zoom not ≈2.5: '+scale);
  await screenshot(mode+'-6-zoomed');
  await sleep(390);await page.touchscreen.tap(x,y);await sleep(100);await page.touchscreen.tap(x,y);await sleep(180);
  const scale2=await stage.evaluate(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).a);
  assert(Math.abs(scale2-1)<.08,'double tap failed to reset zoom: '+scale2);
  await page.getByRole('button',{name:'Действия с фото'}).click();
  for(const label of ['Поделиться','Скопировать ссылку','Пожаловаться на фото','Заблокировать'])
     assert(await page.getByRole('menuitem',{name:label}).count()===1,'photo menu missing '+label);
  await screenshot(mode+'-6-photo-menu');
  await page.getByRole('menuitem',{name:'Пожаловаться на фото'}).click();
  assert(await page.getByText('Пожаловаться',{exact:true}).count()>0,'existing report dialog not opened');
  await screenshot(mode+'-6-report-dialog');
  await page.getByRole('button',{name:'Закрыть'}).last().click();
  await select('Фото');
  await page.locator('.profile-photo-tile').first().click();
  await swipe(210,440,205,710);
  assert(await page.locator('dialog.photo-viewer').count()===0,'downward swipe did not close viewer');
  await setY(0);
  await page.locator('.profile-morph-gallery').click({position:{x:180,y:190}});
  assert(await page.locator('dialog.photo-viewer').isVisible(),'hero photo tap did not open viewer');
  await page.getByRole('button',{name:'Закрыть'}).first().click();
  assert(await page.locator('dialog.photo-viewer').count()===0,'close photo viewer failed');
 });
 await step(mode+'-7-about-and-bottom-action',async()=>{
  await setY(travel+220);
  await select('О себе');
  const text=await page.locator('#profile-panel-0').innerText();
  assert(text.includes('Коротко'),'short facts missing');
  assert(await page.locator('.profile-about-photo').count()===3,'photo mosaic count !=3');
  await screenshot(mode+'-7-about');
  await select('Блики');assert((await page.locator('#profile-panel-1').innerText()).includes('Пока нет бликов'),'Bliki empty state missing');
  await select('Подарки');assert((await page.locator('#profile-panel-4').innerText()).includes('Здесь будет коллекция подарков'),'Gifts empty state missing');
  await select('О себе');
  const cta=page.locator('.profile-action-bar');
  assert(await cta.isVisible(),'fixed action bar missing');
  const caption=await cta.innerText();
  assert(/Перейти к знакомству|Написать/.test(caption),'unexpected CTA '+caption);
  await page.locator('.profile-detail-scroll').evaluate(e=>{e.style.scrollSnapType='none';e.scrollTop=e.scrollHeight});
  await waitFrame();
  const geo=await page.evaluate(()=>{
   const last=document.querySelector('#profile-panel-0 .profile-tabs-stack > :last-child'),cta=document.querySelector('.profile-action-bar');
   const a=last?.getBoundingClientRect(),b=cta?.getBoundingClientRect();
   return {last:a?.toJSON(),cta:b?.toJSON(),maxScroll:document.querySelector('.profile-detail-scroll')?.scrollTop}
  });
  await screenshot(mode+'-7-last-card-and-action');
  assert(geo.last&&geo.cta,'missing last card/CTA bounds');
  assert(geo.last.bottom<=geo.cta.top+1 || geo.last.top>=geo.cta.bottom-1,'last card hidden by CTA '+JSON.stringify(geo));
 });
 await step(mode+'-9-errors',async()=>{assert(!errors.length,errors.join('\n'))});
}
let done=false;
try{
 let up=false;
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok){up=true;break}}catch{}await sleep(250)}
 assert(up,'Vite dev server did not respond');
 for(const mode of ['light','dark','dark-reduced','light-reduced'])await modeRun(mode);
 done=true;
} catch(e){
 results.push({item:'runner',status:'FAIL',reason:String(e?.stack||e)});
}finally{
 await writeFile('qa-shots/results.json',JSON.stringify({commit:'242189cc656f6c552ffa1adf0a33b51fa8028365',results,errors},null,2));
 await browser.close();
 server.kill('SIGTERM');server.stdout.destroy();server.stderr.destroy();
 const fails=results.filter(x=>x.status==='FAIL');
 console.log('QA_RESULT_JSON',JSON.stringify({total:results.length,passed:results.length-fails.length,failed:fails.length,results}));
 if(!done||fails.length)process.exitCode=1;
 process.exit();
}
