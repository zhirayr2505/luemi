/** Opaque, strict pagination cursor for the existing published-only RLS feed.
 * The token controls position, never authorization or profile visibility. */
export type PublishedFeedPosition={offset:number};
export function encodePublishedFeedCursor(item:PublishedFeedPosition):string{
 if(!Number.isSafeInteger(item.offset)||item.offset<1||item.offset>10000)
   throw new Error("invalid_public_feed_cursor");
 return Buffer.from(JSON.stringify(["rank-v1",item.offset]),"utf8").toString("base64url");
}
export function decodePublishedFeedCursor(raw:unknown):PublishedFeedPosition|null{
 if(raw===undefined)return null;
 if(typeof raw!=="string"||raw.length<12||raw.length>256||
    !/^[A-Za-z0-9_-]+$/.test(raw))throw new Error("invalid_public_feed_cursor");
 try{
  const bytes=Buffer.from(raw,"base64url");
  if(bytes.toString("base64url")!==raw)throw new Error("bad_cursor_encoding");
  const json:unknown=JSON.parse(bytes.toString("utf8"));
  if(!Array.isArray(json)||json.length!==2||json[0]!=="rank-v1"||
    !Number.isSafeInteger(json[1])||Number(json[1])<1||Number(json[1])>10000)
   throw new Error("bad_cursor_content");
  return{offset:Number(json[1])};
 }catch{throw new Error("invalid_public_feed_cursor");}
}
