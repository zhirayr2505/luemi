import test from "node:test";
import assert from "node:assert/strict";
import {registrationSubmissionDecision} from "../../web/src/registration/real-submit-gate.js";

test("registration media uploads only for a truly clean server draft",()=>{
 assert.equal(registrationSubmissionDecision({state:"draft",approved:0,pending:0,other:0}),"fresh-upload");
});
test("re-tapping confirmation while images are pending never uploads duplicates",()=>{
 assert.equal(registrationSubmissionDecision({state:"draft",approved:0,pending:3,other:0}),"awaiting-review");
 assert.equal(registrationSubmissionDecision({state:"draft",approved:1,pending:2,other:0}),"awaiting-review");
});
test("server-approved photos are published by explicit resume, not uploaded again",()=>{
 assert.equal(registrationSubmissionDecision({state:"draft",approved:3,pending:0,other:0}),"ready-to-publish");
 assert.equal(registrationSubmissionDecision({state:"hidden",approved:6,pending:0,other:0}),"ready-to-publish");
});
test("partial, rejected, and unknown states do not multiply already-uploaded photos",()=>{
 assert.equal(registrationSubmissionDecision({state:"draft",approved:2,pending:0,other:0}),"review-needs-attention");
 assert.equal(registrationSubmissionDecision({state:"draft",approved:0,pending:0,other:3}),"review-needs-attention");
 assert.equal(registrationSubmissionDecision({state:"draft",approved:3,pending:0,other:1}),"review-needs-attention");
});
test("previously published account enters home without repeated upload",()=>{
 assert.equal(registrationSubmissionDecision({state:"published",approved:3,pending:0,other:0}),"already-published");
});
