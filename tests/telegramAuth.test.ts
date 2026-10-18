import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHmac} from "node:crypto";
import {verifyTelegramInitData} from "../apps/api/src/telegramInitData";

const token="123456:test-only-not-a-real-telegram-secret";
function sign(payload:Record<string,string>) {
 const fields=Object.entries(payload).sort((a,b)=>a[0]<b[0]?-1:1);
 const secret=createHmac("sha256","WebAppData").update(token).digest();
 const hash=createHmac("sha256",secret).update(fields.map(([key,value])=>`${key}=${value}`).join("\n")).digest("hex");
 return new URLSearchParams({...payload,hash}).toString();
}
test("realistic signed initData passes; returns only verified identity",()=>{
 const raw=sign({auth_date:"1792340000",query_id:"AAE",user:JSON.stringify({id:1234567,first_name:"Ani",language_code:"ru"})});
 assert.deepEqual(verifyTelegramInitData(raw,token,1792340030),{id:1234567,first_name:"Ani",last_name:undefined,username:undefined,language_code:"ru"});
 assert.equal(verifyTelegramInitData(raw,token+"other",1792340030),null);
});
test("tamper, replay, duplicates and arbitrary input rejected",()=>{
 const raw=sign({auth_date:"1792340000",user:JSON.stringify({id:124,first_name:"A"})});
 assert.equal(verifyTelegramInitData(raw.replace("124","125"),token,1792340030),null);
 assert.equal(verifyTelegramInitData(raw,token,1792340400),null);
 assert.equal(verifyTelegramInitData(raw+"&user=bad",token,1792340030),null);
 assert.equal(verifyTelegramInitData("123",token,1792340030),null);
 assert.equal(verifyTelegramInitData(raw,"",1792340030),null);
});
