import test from "node:test";
import assert from "node:assert/strict";
import {photoCommitPlan} from "../src/rem05d-private.js";

test("public signup approves only already sanitized media and bypasses the human queue",()=>{
 const plan=photoCommitPlan(true);
 assert.deepEqual(plan,{state:"approved",queueHumanReview:false});
});
test("legacy reviewed registration preserves its previous manual-moderation behavior",()=>{
 const plan=photoCommitPlan(false);
 assert.deepEqual(plan,{state:"pending_review",queueHumanReview:true});
});
test("modes do not allow publishing pending photos as approved",()=>{
 const reviewed=photoCommitPlan(false),publicMode=photoCommitPlan(true);
 assert.notEqual(reviewed.state,publicMode.state);
 assert.equal(reviewed.queueHumanReview,true);
 assert.equal(publicMode.queueHumanReview,false);
});
