import assert from 'node:assert/strict';
import {test} from 'node:test';
import {deliverRegistrationReview,reviewNotificationMessage} from '../src/registration-review-api.js';

const id='11111111-1111-4111-8111-111111111111';
test('moderator message excludes sensitive profile data and has a recognizable request',()=>{
 const message=reviewNotificationMessage(id,4);
 assert.match(message,/Новая анкета/);
 assert.match(message,/11111111/);
 assert.match(message,/4/);
 assert.doesNotMatch(message,/https?:\/\/|фото\.png|birthDate|telegram_id|storage/i);
 assert.throws(()=>reviewNotificationMessage('not-valid',3));
 assert.throws(()=>reviewNotificationMessage(id,7));
});
test('Telegram accepts only successful ok response from configured trusted admin chat',async()=>{
 const calls:{url:string;body:unknown}[]=[];
 const mock=(async (url:string|URL|Request,init?:RequestInit)=>{
  calls.push({url:String(url),body:JSON.parse(String(init?.body))});
  return Response.json({ok:true,result:{message_id:1}});
 }) as typeof fetch;
 const token='123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabc';
 assert.equal(await deliverRegistrationReview(token,'123456789','Private review',mock),true);
 assert.equal(calls.length,1);
 assert.ok(calls[0].url.includes('/sendMessage'));
 assert.deepEqual(calls[0].body,{chat_id:'123456789',text:'Private review',disable_web_page_preview:true});
 assert.equal(await deliverRegistrationReview(token,'-100987654','Denied',mock),false);
 assert.equal(calls.length,1);
 const negative=(async()=>Response.json({ok:false},{status:403})) as typeof fetch;
 assert.equal(await deliverRegistrationReview(token,'123456789','Rejected',negative),false);
});
