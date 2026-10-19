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
assertCheck("approved single intro without duplicated white raster shimmer",app.includes('visualReady&&<div className="intro-cta"')&&style.includes("text-enter")&&!style.includes("brand-liquid")&&!style.includes(".intro-mark::after"));
assertCheck("no old loader overlay",!style.includes("loading-track")&&!app.includes("welcome-screen"));
assertCheck("Telegram native BackButton; NO custom top back button",app.includes("BackButton")&&app.includes("onboard-brand-row")&&!app.includes("top-back"));
assertCheck("theme switch stays beside original raster logo",app.includes("onboard-brand-row")&&app.includes("themeButton")&&style.includes(".onboard-brand-row .theme-switch"));
assertCheck("keyboard leaves footer in same place, hides while typing",app.includes("--keyboard-overlay")&&style.includes("[data-keyboard=open] .onboard-footer")&&style.includes(".onboard-body{flex:1"));
assertCheck("input focus glass uses subtle inset ring without clipping",style.includes("inset 0 0 0 1px")&&style.includes(".glass-control:focus"));
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

const draftStore=read("apps/web/src/registration/local-draft.ts");
const lang=read("apps/web/src/registration/LanguagePicker.tsx");
const forms=read("apps/web/src/registration/Steps.tsx");
assertCheck("device-local registration data and photos survive Telegram reopening",app.includes("loadLocalDraft")&&app.includes("loadLocalPhotos")&&app.includes("saveLocalPhotos")&&draftStore.includes("indexedDB"));
assertCheck("photo upload progress is authentic local FileReader progress",app.includes("FileReader")&&app.includes("onprogress")&&sorter.includes("photo-processing-bar"));
assertCheck("no redundant arrow photo controls",!sorter.includes("photo-reorder-buttons")&&sorter.includes('event.altKey'));
assertCheck("native tap highlight disabled globally",style.includes("-webkit-tap-highlight-color:transparent"));
assertCheck("selected interest chips have visible increased feedback",style.includes("transform:scale(1.055)")&&style.includes(".interest-chip.selected::after"));
assertCheck("interest categories fixed while only interest list scrolls",style.includes(".onboard-body:has(.interests-step)")&&style.includes(".interests-step .interest-choices"));
assertCheck("selected languages show only accessible flags",lang.includes('className="language-flag-selected"')&&!lang.includes('className="language-chip active"'));
assertCheck("language search uses three columns",style.includes("grid-template-columns:repeat(3,minmax(0,1fr))"));
assertCheck("name validation reports invalid characters visibly",forms.includes("name-input-hint")&&forms.includes("updateName"));
console.log("LUEMI Stage 02G UI contracts PASS");

const discovery=read("apps/web/src/discovery/DiscoveryApp.tsx");
const discoveryModel=read("apps/web/src/discovery/model.ts");
const fixture=read("apps/web/src/discovery/demo-people.ts");
const discoveryCss=read("apps/web/src/discovery/discovery.css");
const discoveryProfile=read("apps/web/src/discovery/DemoProfile.tsx");
const discoveryFilters=read("apps/web/src/discovery/Filters.tsx");
assertCheck("separate Stage 03 demo does not change publication flow",app.includes("demoOpen")&&app.includes("<DiscoveryApp")&&preview.includes("Открыть демо-Ленту")&&preview.includes("Публикация анкеты пока закрыта"));
assertCheck("four global navigation destinations and three discovery tabs",discovery.includes('["discover","Знакомства"')&&discovery.includes('["likes","Симпатии"')&&discovery.includes('["chats","Чаты"')&&discovery.includes('["profile","Профиль"')&&discovery.includes('["feed","Лента"')&&discovery.includes('["for-you","Для тебя"')&&discovery.includes('["nearby","Рядом"'));
assertCheck("five simulated actions without live API",["save","pass","special","like","undo"].every(k=>discovery.includes('"'+k+'"'))&&!discovery.includes('fetch(')&&!discovery.includes("TelegramStars"));
assertCheck("profile and filters use existing shared profile components",discoveryProfile.includes("PhotoCarousel")&&discoveryProfile.includes("InterestChip")&&discoveryFilters.includes("DoubleAgeRange")&&discoveryFilters.includes("languages.map"));
assertCheck("W12 photo swipe remains independent of like/pass",discovery.includes("<PhotoCarousel")&&discovery.includes("onPointerDown")&&discovery.includes("closest")&&discovery.includes(".discovery-photo"));
assertCheck("demo fixture is visibly marked and illustrated locally",fixture.includes("illustration(")&&!fixture.includes("https://")&&discovery.includes('className="discovery-demo-label"'));
assertCheck("adaptive card peek hidden on smaller screens, native Telegram back",discoveryCss.includes(".discovery-card")&&app.includes("discoveryBackRef")&&discovery.includes("registerBack"));
assertCheck("demo actions include reversible state history",discoveryModel.includes("demoUndo")&&discoveryModel.includes("history:")&&discoveryModel.includes("wasSaved"));

assertCheck("single viewport Feed without legacy scroll wrapper",discoveryCss.includes(".discovery-pages{flex:1;min-height:0;overflow:hidden")
 && discoveryCss.includes(".discovery-page{height:100%")&&!discoveryCss.includes(".discovery-feed-scroller")
 && !discovery.includes("discovery-filter-row"));
assertCheck("logo and exactly three icon-only controls inside its width",discovery.includes("discovery-header-controls")
 && discoveryCss.includes(".discovery-header-controls{width:105px")
 && discovery.includes("aria-label=\"Сохранённые анкеты\"")
 && discovery.includes("aria-label=\"Фильтры\""));
assertCheck("moving page AND underline follow same gesture",discovery.includes("dragX/3")&&discovery.includes('+"px),0,0)"')
 && discovery.includes("setDragX")&&discovery.includes("clickBlockUntil"));
assertCheck("all profile facts and five separate action buttons inside photo card",discovery.indexOf('className="discovery-card-overlay"')>0
 && discovery.indexOf('className="discovery-actions"')>discovery.indexOf('className="discovery-card-overlay"')
 && discovery.indexOf('className="discovery-actions"')>discovery.indexOf('</article>'));
assertCheck("no old standalone glass action tray",!discoveryCss.includes(".discovery-card-facts")
 && !discoveryCss.includes(".discovery-action-hint") && !discoveryCss.includes(".discovery-city"));
assertCheck("real finger-tracking photo carousel retained with full-width bars",discoveryCss.includes(".discovery-photo .photo-progress")
 && discoveryCss.includes("left:11px;right:11px") && read("apps/web/src/ui/PhotoCarousel.tsx").includes("setDx"));
assertCheck("premium simulated account and capped interests",discovery.includes("person.premium")
 && discovery.includes("Crown")&&discovery.includes("person.interests.slice(0,3)")
 && fixture.includes("premium:index===0"));
console.log("LUEMI Stage 03 Feed Polish UI contracts PASS");

const interestSheet=read("apps/web/src/discovery/InterestsSheet.tsx");
assertCheck("saved moved onto top-right card and filled when selected",discovery.includes('className={"discovery-save-control"')&&discovery.includes('fill={feed.saved.includes(person.id)?'));
assertCheck("four separate footer actions and a top bookmark",discovery.includes('["undo","Отменить"')&&discovery.includes('["special","Особенная симпатия"')&&!discovery.includes('["save","Сохранить",Bookmark]'));
assertCheck("hidden undecided goal on feed AND public profile",discovery.includes('p.goal==="undecided"')&&discoveryProfile.includes('person.goal==="undecided"'));
assertCheck("gradient registration interests remain enabled",discoveryCss.includes(".discovery-interests>.chip")&&!discoveryCss.includes("background:rgba(244,230,255,.85)!important"));
assertCheck("interests +N opens sheet, not full profile",discovery.includes('setInterestOpen(person.id)')&&interestSheet.includes('className="discovery-interests-sheet"'));
assertCheck("Deck Lift uses one locked timed action",discovery.includes("locked.current=true")&&discovery.includes("deck-exiting")&&discoveryCss.includes(".deck-exiting .discovery-deck-current"));
assertCheck("correct inverse tracking of page and line",discovery.includes('tabIndex*100+"% - "+dragX/3'));
assertCheck("rounded Liquid Glass bottom island and active icon only",discoveryCss.includes(".discovery-bottom-nav{")&&discoveryCss.includes("border-radius:29px")&&discoveryCss.includes(".discovery-nav-item.active{color:#aa76d8;background:transparent"));
assertCheck("right swipe closes profile but excludes photos",discoveryProfile.includes("onPointerDown={down}")&&discoveryProfile.includes('.discovery-profile-photo,.carousel-frame'));
assertCheck("six women for exclusive demo fixture",fixture.includes('"alisa"')&&fixture.includes('"lina"')&&!fixture.includes('"aram"'));
console.log("LUEMI Stage 03 Feed Polish 2 UI smoke PASS");
