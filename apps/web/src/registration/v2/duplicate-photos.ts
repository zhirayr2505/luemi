import type {PhotoItem} from "../PhotoSorter";

/**
 * Free, on-device preflight to catch exact duplicate image bytes before a
 * private profile is saved. This is NOT face identity comparison, and is never
 * accepted as a server-side or biometric safety approval.
 */
export async function findExactDuplicatePhotoIds(
  photos:readonly Pick<PhotoItem,"id"|"file"|"preview">[]
):Promise<string[]>{
 // A browser without WebCrypto must not silently treat unchecked images
 // as distinct. The user can retry using a supported secure WebView.
 if(!globalThis.crypto?.subtle)throw new Error("photo_digest_unavailable");
 const seen=new Map<string,string>();
 const duplicates:string[]=[];
 for(const photo of photos){
  const blob=photo.preview??photo.file;
  const sha=await crypto.subtle.digest("SHA-256",await blob.arrayBuffer());
  const hex=Array.from(new Uint8Array(sha),b=>b.toString(16).padStart(2,"0")).join("");
  if(seen.has(hex))duplicates.push(photo.id);
  else seen.set(hex,photo.id);
 }
 return duplicates;
}
