/** Trust only the authenticated server manifest, never a local upload bar. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function confirmedPrivateMediaCount(value:unknown,expected:number):number{
 if(!Number.isSafeInteger(expected)||expected<3||expected>6)
  throw new Error("invalid_expected_photo_count");
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new Error("invalid_private_media_manifest");
 const manifest=value as Record<string,unknown>;
 if(manifest.status!=="unpublished"||!Array.isArray(manifest.photos))
  throw new Error("invalid_private_media_manifest");
 const ids=new Set<string>();
 for(const photo of manifest.photos){
  if(!photo||typeof photo!=="object"||Array.isArray(photo))
   throw new Error("invalid_private_media_receipt");
  const asset=photo as Record<string,unknown>;
  if(typeof asset.id!=="string"||!uuid.test(asset.id)||ids.has(asset.id)||
     (asset.state!=="pending_review"&&asset.state!=="approved"))
   throw new Error("incomplete_private_media");
  ids.add(asset.id);
 }
 if(ids.size<expected||ids.size>6)throw new Error("incomplete_private_media");
 return ids.size;
}
