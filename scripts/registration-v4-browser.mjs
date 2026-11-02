import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const base=process.env.V4_QA_URL??'http://127.0.0.1:4173/registration-v4-qa.html';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);
 try{await page.getByRole('heading',{name:'Всё готово'}).waitFor({timeout:10000});}
 catch(error){
  mkdirSync('docs/registration-v4/screenshots',{recursive:true});
  await page.screenshot({path:'docs/registration-v4/screenshots/debug.png'});
  console.error('QA page text:',(await page.locator('body').textContent())?.slice(0,1000),'page errors:',errors);
  throw error;
 }
 for(let i=0;i<7;i++){await page.getByRole('button',{name:'Назад',exact:true}).click();await page.waitForTimeout(300);}
 const names=['Как тебя зовут?','Расскажи о себе','Где ты сейчас?','Кого ты хочешь встретить?','Что ты ищешь?','Добавь характер','Покажи себя','Всё готово'];
 const dir='docs/registration-v4/screenshots';mkdirSync(dir,{recursive:true});
 for(let i=0;i<8;i++){
  await page.getByRole('heading',{name:names[i]}).waitFor();
  assert.equal(await page.locator('.v4-progress span').count(),8);
  assert.equal(await page.locator('.v4-back').count(),i===0?0:1);
  const footer=await page.locator('.v4-footer').boundingBox();assert.ok(footer&&footer.y+footer.height<=852);
  if(i===0){
   await page.getByRole('textbox',{name:'Имя'}).focus();
   await page.setViewportSize({width:393,height:520});await page.waitForTimeout(120);
   assert.equal(await page.locator('.v4-registration').getAttribute('data-keyboard'),'open');
   const compactFooter=await page.locator('.v4-footer').boundingBox();
   assert.ok(compactFooter&&compactFooter.y+compactFooter.height<=520,'keyboard must not cover the footer');
   await page.setViewportSize({width:393,height:852});
   await page.getByRole('textbox',{name:'Имя'}).blur();await page.waitForTimeout(120);
  }
  await page.screenshot({path:`${dir}/${String(i+1).padStart(2,'0')}.png`});
  if(i<7){
   await page.getByRole('button',{name:'Продолжить'}).click();await page.waitForTimeout(300);
   if(i===0){
    await page.evaluate(()=>window.__LUEMI_V4_BACK__?.());
    await page.getByRole('heading',{name:names[0]}).waitFor();
    await page.waitForTimeout(300);
    await page.getByRole('button',{name:'Продолжить'}).click();await page.waitForTimeout(300);
   }
  }
 }
 assert.deepEqual(errors,[]);
 console.log('Registration V4: 8 screens, keyboard viewport, native Back and footer geometry PASS');
}finally{await browser.close();}
