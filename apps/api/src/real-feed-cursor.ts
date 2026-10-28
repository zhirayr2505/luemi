/** Opaque, strict pagination cursor for the existing published-only RLS feed.
 * The token controls position, never authorization or profile visibility. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export type PublishedFeedPosition={at:string;id:string};
export function encodePublishedFeedCursor(item:PublishedFeedPosition):string{
 if(!UUID.test(item.id)||!ISO.test(item.at)||
    !Number.isFinite(Date.parse(item.at))||
    new Date(item.at).toISOString()!==item.at)
  throw new Error("invalid_public_feed_cursor");
 return Buffer.from(JSON.stringify([item.at,item.id]),"utf8").toString("base64url");
}
export function decodePublishedFeedCursor(raw:unknown):PublishedFeedPosition|null{
 if(raw===undefined)return null;
 if(typeof raw!=="string"||raw.length<12||raw.length>256||
    !/^[A-Za-z0-9_-]+$/.test(raw))throw new Error("invalid_public_feed_cursor");
 try{
  const bytes=Buffer.from(raw,"base64url");
  if(bytes.toString("base64url")!==raw)throw new Error("bad_cursor_encoding");
  const json:unknown=JSON.parse(bytes.toString("utf8"));
  if(!Array.isArray(json)||json.length!==2)throw new Error("bad_cursor_shape");
  const [at,id]:unknown[]=json;
  if(typeof at!=="string"||typeof id!=="string"||!UUID.test(id)||
     !ISO.test(at)||!Number.isFinite(Date.parse(at))||
     new Date(at).toISOString()!==at)throw new Error("bad_cursor_content");
  return{at,id};
 }catch{throw new Error("invalid_public_feed_cursor");}
}
