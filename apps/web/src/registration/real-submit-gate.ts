/**
 * Never re-upload the already persisted private media set when a user taps
 * the registration confirmation repeatedly or returns after a restart.
 * All decisions use a fresh authenticated server status, not local booleans.
 */
export interface ServerRegistrationMediaStatus{
 state:"draft"|"published"|"hidden";
 approved:number;pending:number;other:number;
}
export type SubmissionDecision=
 "already-published"|"awaiting-review"|"ready-to-publish"|
 "review-needs-attention"|"fresh-upload";
export function registrationSubmissionDecision(status:ServerRegistrationMediaStatus):SubmissionDecision{
 if(status.state==="published")return"already-published";
 if(status.pending>0&&status.other===0&&status.pending+status.approved<3)
  return"fresh-upload"; // interrupted 1–2-photo upload, safe idempotent resume
 if(status.pending>0)return"awaiting-review";
 if(status.approved>=3&&status.approved<=6&&status.other===0)
  return"ready-to-publish";
 if(status.approved>0||status.other>0)return"review-needs-attention";
 return"fresh-upload";
}
