import {GeoBudget} from "../src/rem05c-quota.js";
const namespace=process.argv[2],actor=process.argv[3];
const url=process.env.REM05C_TEST_BUDGET_DATABASE_URL;
if(!url||!namespace||!actor)throw new Error("Disposable worker config missing");
const budget=new GeoBudget({databaseUrl:url,namespace,
 actorSearchPerDay:50,actorReversePerDay:50,globalDailyCap:8,
 vendorDailyQuota:10,maxInFlight:3},"synthetic_multiworker_key");
try{
 const results=await Promise.all(Array.from({length:50},async()=>{
  const result=await budget.reserve(actor,"search");
  if(!result.ok)return 0;
  await result.release();
  return 1;
 }));
 process.stdout.write(JSON.stringify({accepted:results.reduce((a,b)=>a+b,0)})+"\n");
}finally{await budget.close();}
