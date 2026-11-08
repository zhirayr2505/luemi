import type {DemoPerson} from "./model";
import {normalizeCountryCode} from "@luemi/contracts";
/** Deliberately illustrated ORIGINAL fictional characters, never photographs of real users. */
function illustration(index:number,variation:number):string{
 const palette=[["#d7c6f0","#f1c9db","#51334f","#c88666"],["#badedc","#efd8e3","#392c49","#b57f66"],["#e4c9f4","#ffd9c6","#352b47","#946044"],["#ced8f6","#e6bcd7","#3b293b","#c08467"],["#d6e8d7","#f9cadd","#412f36","#ad765a"],["#d1c3ea","#f1dfbc","#4a354e","#996a54"],["#e2d3f5","#bedede","#332b46","#ba8762"],["#e7cfce","#d4dcf5","#422e40","#c28d65"]];
 const [bg,accent,hair,skin]=palette[index%palette.length];
 const shift=variation*8+(index%5)*3,wear=variation?"#7e699e":"#74608c",
  skinShade=variation?"#ce9a76":skin;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 760" width="600" height="760">
 <defs><linearGradient id="bg" x1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="${accent}"/></linearGradient>
 <linearGradient id="shirt" x1="0" x2=".9" y2="1"><stop stop-color="${wear}"/><stop offset="1" stop-color="#dba6ca"/></linearGradient></defs>
 <rect width="600" height="760" fill="url(#bg)"/>
 <circle cx="${470-shift}" cy="145" r="150" fill="#fff" opacity=".22"/>
 <circle cx="115" cy="490" r="195" fill="#fff" opacity=".14"/>
 <path d="M0 700 Q130 578 260 660T600 612V760H0" fill="#fff" opacity=".18"/>
 <ellipse cx="300" cy="820" rx="275" ry="300" fill="url(#shirt)"/>
 <path d="M225 508 L212 630 Q298 683 386 630L370 492" fill="${skinShade}"/>
 <path d="M160 285 Q153 116 300 112 Q458 118 446 318L440 480Q300 575 170 476Z" fill="${hair}"/>
 <ellipse cx="300" cy="344" rx="118" ry="170" fill="${skinShade}"/>
 <path d="M180 304 Q202 128 302 149 Q410 149 431 307 Q377 288 343 221 Q287 280 180 304Z" fill="${hair}"/>
 <path d="M232 350q20-10 42 0m67 0q20-10 42 0" stroke="#473345" stroke-width="7" fill="none" stroke-linecap="round"/>
 <path d="M286 415q13 7 27 0" stroke="#8b5f5e" stroke-width="5" fill="none" stroke-linecap="round"/>
 <path d="M267 454q32 22 66 0" stroke="#8e5262" stroke-width="6" fill="none" stroke-linecap="round"/>
 <ellipse cx="212" cy="368" rx="15" ry="29" fill="${skinShade}"/><ellipse cx="388" cy="368" rx="15" ry="29" fill="${skinShade}"/>
 <path d="M142 648Q300 549 459 648" stroke="#fff" stroke-opacity=".3" stroke-width="16" fill="none"/>
 </svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
/** Six AI-generated reference portraits, royalty-free Pixabay Content License.
 * These are NOT real LUEMI users or actual people. Remote images are only for
 * the staging demo; fall back to original in-repo illustrated avatars offline. */
const portraitSources=["https://cdn.pixabay.com/photo/2024/12/05/15/18/ai-generated-9246846_1280.jpg","https://cdn.pixabay.com/photo/2025/04/18/05/26/ai-generated-9541651_1280.jpg","https://cdn.pixabay.com/photo/2026/01/01/12/33/ai-generated-10046459_1280.jpg","https://cdn.pixabay.com/photo/2026/02/07/12/42/atal07-ultra-realistic-portrait-10109677_1280.jpg","https://cdn.pixabay.com/photo/2023/12/09/19/09/ai-generated-8439990_1280.jpg","https://cdn.pixabay.com/photo/2023/10/21/08/58/ai-generated-8331057_1280.jpg"];
/** Distinct scene images create real photo changes and varied image-sourced ambient lighting.
 * No identifiable people in these additional Unsplash photographs. The first
 * portrait in every fixture is synthetic and already used by the demo client.
 * All references are illustrative and never constitute an actual LUEMI profile. */
const scenes:readonly (readonly string[])[]=[
 ["photo-1441974231531-c6227db76b6e","photo-1495474472287-4d71bcdd2085","photo-1507525428034-b723cf961d3e"],
 ["photo-1516483638261-f4dbaf036963","photo-1495446815901-a7297e633e8d","photo-1509042239860-f550ce710b93"],
 ["photo-1464822759023-fed622ff2c3b","photo-1470770841072-f978cf4d019e","photo-1448375240586-882707db888b"],
 ["photo-1502602898657-3e91760cbb34","photo-1489599849927-2ee91cede3ba","photo-1499856871958-5b9627545d1a"],
 ["photo-1517836357463-d25dfeac3438","photo-1470252649378-9c29740c9fa8","photo-1519681393784-d120267933ba"],
 ["photo-1476514525535-07fb3b4ae5f1","photo-1518770660439-4636190af475","photo-1512621776951-a57141f2eefd"]
];
const sceneUrl=(id:string)=>"https://images.unsplash.com/"+id+"?auto=format&fit=crop&w=960&q=80";
const base=[
 ["mira","Мира",25,"woman","Краснодар","Россия","ru","relationship","Музыка|Путешествия|Фотография|Кофе|Книги","ru|en","Люблю уютные кофейни, море и длинные разговоры. Ценю искренних и добрых людей."],
 ["sofia","София",27,"woman","Тбилиси","Грузия","ge","serious","Книги|Живопись|Кофе|Танцы","ru|en","Вдохновение нахожу в маленьких кафе, старых улочках и встречах с близкими."],
 ["nara","Нара",24,"woman","Гюмри","Армения","am","friendship","Путешествия|Фотография|Языки|Природа","hy|en","Обожаю горы и поездки без плана. Верю, что хорошая дружба начинается с разговора."],
 ["ella","Элла",26,"woman","Париж","Франция","fr","dates","Кино|Кофе|Живопись|Музыка","fr|en","Городские огни, утренние пробежки и разговоры обо всём на свете."],
 ["alisa","Алиса",28,"woman","Москва","Россия","ru","communication","Спорт|Дизайн|Книги|Прогулки","ru|en","Люблю начинать выходные с музеев, потом находить новое место с отличным кофе."],
 ["lina","Лина",29,"woman","Берлин","Германия","de","undecided","Технологии|Путешествия|Кулинария|Кино","de|en","Умею замечать красивые мелочи. Мне нравится узнавать новые культуры и людей."],
 ["anahit","Анаит",26,"woman","Ереван","Армения","am","serious","Кулинария|Архитектура|Искусство|Музыка","hy|ru","Могу часами гулять по вечернему городу и обсуждать любимую музыку."],
 ["mark","Марк",28,"man","Краснодар","Россия","ru","relationship","Спорт|Кино|Путешествия|Кофе","ru|en","Люблю горы, велосипеды и импровизированные поездки на выходные."],
 ["maria","Мария",23,"woman","Сочи","Россия","ru","dates","Танцы|Море|Фотография|Природа","ru|en","Обожаю закаты у моря, спонтанные прогулки и искренние улыбки."],
 ["aram","Арам",30,"man","Гюмри","Армения","am","friendship","Музыка|Технологии|Книги|Путешествия","hy|ru","Люблю живые концерты, добрый юмор и содержательные разговоры."],
 ["eva","Ева",25,"woman","Тбилиси","Грузия","ge","communication","Искусство|Кино|Кофе|Йога","ru|en","Мечтаю однажды открыть маленькую кофейню с книжной полкой."],
 ["david","Давид",27,"man","Москва","Россия","ru","family_goal","Кулинария|Спорт|Путешествия|Прогулки","ru|en","Умею приготовить отличный завтрак и найти красивые маршруты по городу."],
 ["selin","Селин",24,"woman","Стамбул","Турция","tr","dates","Дизайн|Книги|Искусство|Танцы","tr|en","Люблю старинные улочки, вечерний свет и новые открытия."],
 ["ani","Ани",29,"woman","Ванадзор","Армения","am","serious","Книги|Кофе|Природа|Фотография","hy|ru","Мне нравятся тихие места, смелые планы и люди, которые держат слово."],
 ["leo","Лео",31,"man","Амстердам","Нидерланды","nl","undecided","Технологии|Велосипед|Музыка|Кино","en|nl","За хороший разговор и неожиданные путешествия без расписания."]
] as const;
export const demoPeople:DemoPerson[]=base.map((p,index)=>({
 id:p[0],name:p[1],age:p[2],gender:p[3] as DemoPerson["gender"],city:p[4],country:p[5],countryCode:normalizeCountryCode(p[6])??"",
 goal:p[7] as DemoPerson["goal"],premium:index===0||index===3,interests:p[8].split("|").map(x=>x.toLocaleLowerCase("ru").replace(/\s+/g,"-")),
 languages:p[9].split("|"),about:p[10],
 photos:[
 {id:p[0]+"-1",src:index<portraitSources.length?portraitSources[index]:illustration(index,0),fallback:illustration(index,0)},
 {id:p[0]+"-2",src:illustration(index,1),fallback:illustration(index,1)},
 ...scenes[index%scenes.length].slice(0,2).map((id,variation)=>({
  id:p[0]+"-"+(variation+3),
  src:sceneUrl(id),fallback:illustration(index,variation+1)
 }))
 ]
}));
