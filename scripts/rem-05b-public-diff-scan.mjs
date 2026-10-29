import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const originalAccepted="bc994acfb815d4712431fad5c13070793d361af6";
const configured=process.env.LUEMI_DIFF_BASE_SHA;
if(configured&&!/^[a-f0-9]{40}$/i.test(configured))
 throw new Error("LUEMI_DIFF_BASE_SHA must be a 40-character Git commit SHA");
const accepted=configured??originalAccepted;
const files=execFileSync("git",["diff","--name-only",accepted,"HEAD"],{encoding:"utf8",maxBuffer:8*1024*1024})
 .trim().split("\n").filter(Boolean);
const patch=execFileSync("git",["diff","--unified=0",accepted,"HEAD"],{encoding:"utf8",maxBuffer:16*1024*1024});
const additions=patch.split("\n").filter(x=>x.startsWith("+")&&!x.startsWith("+++")).map(x=>x.slice(1));
const paths=files.filter(x=>/(^|\/)\.env(?:\.|$)|\.(?:p12|pfx|pem|key|sqlite|db|dump)$/i.test(x));
const patterns=[
 ["telegram_bot_credential",/\b\d{6,12}:[A-Za-z0-9_-]{32,}\b/],
 ["private_key_material",/-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) PRIVATE KEY-----/],
 ["github_pat",/\bgh[psu]_[A-Za-z0-9]{30,}\b/],
 ["aws_access_key",/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
 ["non_synthetic_db_url",/postgres(?:ql)?:\/\/\S+:\S+@/]
];
const violations=[];
for(const path of paths)violations.push({category:"sensitive_path",path});
for(const line of additions){
 for(const [category,re] of patterns){
  if(!re.test(line))continue;
  if(category==="non_synthetic_db_url"&&/synthetic_/i.test(line))continue;
  violations.push({category});
 }
}
const tally=Object.fromEntries([...new Set(violations.map(x=>x.category))]
 .map(k=>[k,violations.filter(x=>x.category===k).length]));
console.log("REM05B_PUBLIC_DIFF_SECRET_SCAN",JSON.stringify({
 inspectedPaths:files.length,addedLines:additions.length,violationCounts:tally,
 credentialValuesPrinted:false
}));
assert.equal(violations.length,0,"Public change contains potentially sensitive credential material");
