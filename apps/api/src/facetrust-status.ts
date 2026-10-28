import type {FastifyInstance,FastifyRequest,FastifyReply} from "fastify";

/** Public-facing status for an authenticated draft account.
 * Server NEVER derives approval from client-side head turns or a self-reported
 * checkbox. An actual privileged worker / persisted database approval will be
 * required before we can return a verified state.
 */
type Guards={read:(request:FastifyRequest,reply:FastifyReply)=>Promise<void>};
export function registerFaceTrustCapabilities(app:FastifyInstance,guards:Guards|undefined){
 if(!guards)return;
 app.get("/api/v2/facetrust/status",{preHandler:guards.read},async(_request,reply)=>{
  reply.header("Cache-Control","private, no-store");
  return{
   state:"provider_not_connected" as const,
   faceLivenessAvailable:false,
   photoComparisonAvailable:false,
   photoAutoReviewAvailable:false,
   verified:false,
   publicProfileEligible:false,
   cameraPreviewAvailable:true,
   supportsPrivateDraft:true
  };
 });
}
