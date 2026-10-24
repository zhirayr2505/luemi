import assert from "node:assert/strict";
import test from "node:test";
import {projectProfile,type ProfileMasterData} from "../../web/src/discovery/ProfileModel.js";

const ATTACKER_MEDIA = "https://example.invalid/unguarded-story.jpg";
const profile:ProfileMasterData={
  id:"synthetic-author",source:"server",name:"Synthetic",age:28,
  city:"Test",country:"Test",countryCode:"DE",goal:null,about:"",
  interests:[],languages:[],photos:[],verified:false,premium:false,
  registeredAt:null,updatedAt:null,
  activeBlik:{id:"forged",kind:"image",src:ATTACKER_MEDIA,expiresAt:"2099-01-01T00:00:00Z"}
};
test("LU-29 RED: malicious server activeBlik cannot enter visitor projection",()=>{
  const projected=projectProfile(profile,"visitor");
  assert.equal(projected.profile.activeBlik,null,
    "HTTPS URL and future expiration are NOT server permissions");
});
test("LU-29 RED: owner preview does not inherit unexpected server Blik entitlement",()=>{
  const forged={...profile,activeBlik:{...profile.activeBlik,id:"forged2"},
    blikiEnabled:true,canViewBliki:true,blikCapability:"published"};
  const projected=projectProfile(forged as ProfileMasterData,"owner");
  assert.equal(projected.profile.activeBlik,null);
});
