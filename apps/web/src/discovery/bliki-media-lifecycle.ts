/**
 * REM-05F — future Bliki media lifecycle primitive, NOT mounted by the app.
 * Pure event-driven clock; no RAF, no React setState, no network or media src.
 * Only a separately authorized future viewer can own one session.
 */
export type BlikMediaKind="image"|"video";
export type BlikMediaPhase="loading"|"decoded"|"ready"|"playing"|"paused"|"buffering"|"error"|"expired"|"revoked";
type Cleanup=()=>void;
export class BlikMediaSession {
 private generation=0;
 private phase:BlikMediaPhase="loading";
 private kind:BlikMediaKind="image";
 private durationMs=6000;
 private imageLoaded=false;
 private imageDecoded=false;
 private held=false;
 private visible=true;
 private elapsedMs=0;
 private lastClockMs:number|null=null;
 private videoSeconds=0;
 private ended=false;
 private cleanups:Cleanup[]=[];
 private disposed=false;
 private cleaned=0;
 /** Beginning a new generation cancels old callbacks, disposes old resources. */
 begin(kind:BlikMediaKind,durationMs:number):number {
  this.release();
  this.generation++;
  this.disposed=false;
  this.kind=kind;this.phase="loading";
  this.durationMs=Math.max(2500,Math.min(30000,Number.isFinite(durationMs)?durationMs:6000));
  this.imageLoaded=false;this.imageDecoded=false;this.held=false;this.visible=true;
  this.elapsedMs=0;this.videoSeconds=0;this.lastClockMs=null;this.ended=false;
  return this.generation;
 }
 currentGeneration(){return this.generation;}
 snapshot(){return {generation:this.generation,phase:this.phase,
  progress:this.progress(),closed:this.disposed,resources:this.cleanups.length,cleaned:this.cleaned};}
 /** Resource cleanup functions must be added only to current generation. */
 own(token:number,release:Cleanup):boolean{
  if(!this.live(token)){release();return false;}
  this.cleanups.push(release);return true;
 }
 private live(token:number){return !this.disposed&&token===this.generation&&
  !["error","expired","revoked"].includes(this.phase);}
 private release(){
  const list=this.cleanups.splice(0);
  for(const release of list)try{release();}catch{/* cleanup stays best effort */}
  this.cleaned+=list.length;
 }
 private advance(nowMs:number){
  if(!Number.isFinite(nowMs))return;
  if(this.phase==="playing"&&this.kind==="image"&&this.lastClockMs!==null){
   this.elapsedMs=Math.min(this.durationMs,this.elapsedMs+
      Math.max(0,Math.min(60000,nowMs-this.lastClockMs)));
  }
  this.lastClockMs=nowMs;
 }
 private resume(nowMs:number){
  this.lastClockMs=nowMs;
  if(this.phase==="error"||this.phase==="revoked"||this.phase==="expired")return;
  this.phase=this.held||!this.visible?"paused":"playing";
 }
 loaded(token:number){
  if(!this.live(token)||this.kind!=="image")return false;
  this.imageLoaded=true;
  this.phase=this.imageDecoded?"ready":"loading";
  return true;
 }
 decoded(token:number){
  if(!this.live(token)||this.kind!=="image")return false;
  this.imageDecoded=true;
  this.phase=this.imageLoaded?"ready":"decoded";
  return true;
 }
 imageReadyToPlay(token:number,nowMs:number){
  if(!this.live(token)||this.kind!=="image"||!this.imageLoaded||!this.imageDecoded)return false;
  if(!["ready","paused","playing"].includes(this.phase))return false;
  this.resume(nowMs);return this.phase==="playing";
 }
 videoReady(token:number,nowMs:number){
  if(!this.live(token)||this.kind!=="video")return false;
  this.phase="ready";this.resume(nowMs);return this.phase==="playing";
 }
 videoTime(token:number,currentTimeSeconds:number,durationSeconds:number){
  if(!this.live(token)||this.kind!=="video"||this.phase!=="playing"||
    !Number.isFinite(currentTimeSeconds)||!Number.isFinite(durationSeconds)||
    durationSeconds<=0)return false;
  this.videoSeconds=Math.max(0,Math.min(durationSeconds,currentTimeSeconds))/
    durationSeconds;
  return true;
 }
 buffering(token:number,nowMs:number){
  if(!this.live(token)||this.kind!=="video")return false;
  this.advance(nowMs);this.phase="buffering";return true;
 }
 playing(token:number,nowMs:number){
  if(!this.live(token)||this.kind!=="video"||this.ended)return false;
  this.resume(nowMs);return this.phase==="playing";
 }
 hold(token:number,on:boolean,nowMs:number){
  if(!this.live(token))return false;
  this.advance(nowMs);this.held=on;
  if(this.kind==="image"&&(!this.imageLoaded||!this.imageDecoded))return true;
  if(this.kind==="video"&&this.phase==="buffering")return true;
  this.resume(nowMs);return true;
 }
 visibility(token:number,on:boolean,nowMs:number){
  if(!this.live(token))return false;
  this.advance(nowMs);this.visible=on;
  if(this.kind==="image"&&(!this.imageLoaded||!this.imageDecoded))return true;
  if(this.kind==="video"&&this.phase==="buffering")return true;
  this.resume(nowMs);return true;
 }
 endedOnce(token:number):boolean{
  if(!this.live(token)||this.ended)return false;
  this.ended=true;this.phase="paused";
  if(this.kind==="video")this.videoSeconds=1;
  else this.elapsedMs=this.durationMs;
  return true;
 }
 error(token:number){return this.terminal(token,"error");}
 expired(token:number){return this.terminal(token,"expired");}
 revoked(token:number){return this.terminal(token,"revoked");}
 private terminal(token:number,phase:"error"|"expired"|"revoked"){
  if(!this.live(token))return false;
  this.phase=phase;this.lastClockMs=null;this.release();return true;
 }
 progress(nowMs?:number){
  if(this.disposed)return 0;
  if(this.kind==="video")return this.videoSeconds;
  if(nowMs!==undefined)this.advance(nowMs);
  return Math.max(0,Math.min(1,this.elapsedMs/this.durationMs));
 }
 cleanup(){
  if(this.disposed)return;
  this.disposed=true;this.generation++;this.release();
  this.lastClockMs=null;this.phase="paused";
 }
}
