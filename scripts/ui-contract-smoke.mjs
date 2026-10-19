import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("apps/web/src/App.tsx"),steps=read("apps/web/src/registration/Steps.tsx");
const style=read("apps/web/src/styles.css"),sorter=read("apps/web/src/registration/PhotoSorter.tsx");
const preview=read("apps/web/src/registration/Preview.tsx"),geo=read("apps/web/src/registration/GeoPicker.tsx");
const model=read("apps/web/src/registration/model.ts");
const catalog=read("apps/web/src/ui/InterestCatalog.tsx");
const languages=read("apps/web/src/ui/Languages.ts");
const assertCheck=(s,test)=>{assert.ok(test,s);console.log("✓",s)};
assertCheck("approved single branded intro with liquid logo and sequential CTA",app.includes("visualReady&&<div className=\"intro-cta\"")&&style.includes("brand-liquid")&&style.includes("text-enter"));
assertCheck("no old loader overlay",!style.includes("loading-track")&&!app.includes("welcome-screen"));
assertCheck("Telegram native BackButton; NO custom top back button",app.includes("BackButton")&&app.includes("onboard-brand-row")&&!app.includes("top-back"));
assertCheck("theme switch stays beside original raster logo",app.includes("onboard-brand-row")&&app.includes("themeButton")&&style.includes(".onboard-brand-row .theme-switch"));
assertCheck("keyboard leaves footer in same place, hides while typing",app.includes("--keyboard-overlay")&&style.includes("[data-keyboard=open] .onboard-footer")&&style.includes(".onboard-body{flex:1"));
assertCheck("input focus outline uses inset shadows",style.includes("inset 0 0 0 2px"));
assertCheck("three exclusive search modes",model.includes('SearchScope = "radius" | "country" | "world"')&&geo.includes("scopeOptions"));
assertCheck("range 5000km mapped nonlinearly",geo.includes("radiusAt")&&geo.includes("4999"));
assertCheck("six goals including undecided",model.includes('"undecided"')&&model.includes("Серьёзные отношения")&&steps.includes("goalIcons"));
assertCheck("ten interest categories and floating selection",catalog.includes("export const categories")&&app.includes("SelectedInterests")&&style.includes(".selected-interests-floating"));
assertCheck("60 searchable languages with true vector flags",languages.includes("export const languages")&&read("apps/web/src/registration/LanguagePicker.tsx").includes("<Flag"));
assertCheck("portal drag renders at actual viewport finger coordinates",sorter.includes("createPortal")&&sorter.includes("getBoundingClientRect")&&sorter.includes("setDrag"));
assertCheck("photo reorder has FLIP animation and main label",sorter.includes("node.animate(")&&sorter.includes("Главное"));
assertCheck("single profile preview and single edit button",preview.includes("Изменить анкету")&&!preview.includes("preview-tabs")&&!preview.includes("Изменить имя")&&!preview.includes("Изменить фото"));
assertCheck("local images remain local only",sorter.includes("snapshot")&&!app.includes("uploadPhoto"));

const catalogSource=catalog.match(/const source=(\[.*?\]);\s*export const categories/s);
assertCheck("catalog contains exactly ten 12–16 item categories",Boolean(catalogSource) && (() => {
 const all=JSON.parse(catalogSource[1]);return all.length===10 && all.every(c=>c.items.length>=12&&c.items.length<=16);
})());
const listSource=languages.match(/export const languages:LanguageOption\[\]=(\[.*?\]);\s*export function/s);
assertCheck("language catalog contains exactly sixty distinct BCP47 codes",Boolean(listSource)&&(()=>{
 const all=JSON.parse(listSource[1]);return all.length===60&&new Set(all.map(x=>x.id)).size===60;
})());
const flags=readdirSync(new URL("../apps/web/public/assets/flags/",import.meta.url)).filter(x=>/^[a-z]{2}\.svg$/.test(x));
assertCheck("66 genuine circular SVG flags shipped locally",flags.length===66);
assertCheck("no stale duplicated theme/header or obsolete two-tab preview",!style.includes(".preview-tabs{")&&!style.includes(".review-actions{")&&!style.includes(".theme-pulsing")&&!app.includes("startViewTransition"));
console.log("LUEMI Stage 02F UI contracts PASS");
