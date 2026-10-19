import type {DemoPerson} from "./model";
/** Deliberately illustrated ORIGINAL fictional characters, never photographs of real users. */
function illustration(index:number,variation:number):string{
 const palette=[["#d7c6f0","#f1c9db","#51334f","#c88666"],["#badedc","#efd8e3","#392c49","#b57f66"],["#e4c9f4","#ffd9c6","#352b47","#946044"],["#ced8f6","#e6bcd7","#3b293b","#c08467"],["#d6e8d7","#f9cadd","#412f36","#ad765a"],["#d1c3ea","#f1dfbc","#4a354e","#996a54"],["#e2d3f5","#bedede","#332b46","#ba8762"],["#e7cfce","#d4dcf5","#422e40","#c28d65"]];
 const [bg,accent,hair,skin]=palette[index%palette.length];
 const shift=variation*8,wear=variation?"#7e699e":"#74608c",skinShade=variation?"#ce9a76":skin;
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
const base=[
 ["mira","Мира",25,"woman","Краснодар","Россия","ru","relationship","Музыка|Путешествия|Фотография|Кофе|Книги","ru|en","Люблю уютные кофейни, море и длинные разговоры. Ценю искренних и добрых людей."],
 ["sofia","София",27,"woman","Тбилиси","Грузия","ge","serious","Книги|Живопись|Кофе|Танцы","ru|en","Вдохновение нахожу в маленьких кафе, старых улочках и встречах с близкими."],
 ["nara","Нара",24,"woman","Гюмри","Армения","am","friendship","Путешествия|Фотография|Языки|Природа","hy|en","Обожаю горы и поездки без плана. Верю, что хорошая дружба начинается с разговора."],
 ["ella","Элла",26,"woman","Париж","Франция","fr","dates","Кино|Кофе|Живопись|Музыка","fr|en","Городские огни, утренние пробежки и разговоры обо всём на свете."],
 ["alisa","Алиса",28,"woman","Москва","Россия","ru","communication","Спорт|Дизайн|Книги|Прогулки","ru|en","Люблю начинать выходные с музеев, потом находить новое место с отличным кофе."],
 ["lina","Лина",29,"woman","Берлин","Германия","de","undecided","Технологии|Путешествия|Кулинария|Кино","de|en","Умею замечать красивые мелочи. Мне нравится узнавать новые культуры и людей."]
] as const;
export const demoPeople:DemoPerson[]=base.map((p,index)=>({
 id:p[0],name:p[1],age:p[2],gender:p[3] as DemoPerson["gender"],city:p[4],country:p[5],countryCode:p[6],
 goal:p[7] as DemoPerson["goal"],premium:index===0||index===3,interests:p[8].split("|").map(x=>x.toLocaleLowerCase("ru").replace(/\s+/g,"-")),
 languages:p[9].split("|"),about:p[10],
 photos:[
 {id:p[0]+"-1",src:portraitSources[index],fallback:illustration(index,0)},
 {id:p[0]+"-2",src:portraitSources[index],fallback:illustration(index,1)}
 ]
}));
