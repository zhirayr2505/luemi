import {createRoot} from "react-dom/client";
import {ProfileMorphSurface} from "../rendering/ProfileMorphSurface";
document.body.style.margin="0";
const host=document.getElementById("root");
if(host){host.style.cssText="width:100vw;height:100dvh;overflow:hidden";createRoot(host).render(<ProfileMorphSurface/>);}
