import type {DemoPerson} from "./model";
import {normalizeCountryCode} from "@luemi/contracts";
import {demoPeople} from "./demo-people";

/** Original synthetic SVG portraits: consistent faces between a profile's two photographs.
 * Existing six Feed fixtures remain COMPLETELY untouched. */
function avatar(index:number,variation:number,gender:DemoPerson["gender"]):string{
 const palettes=[
 ["#dac7f1","#efbdd5","#4a3549","#c18a6a","#a68ad4"],
 ["#d4e3ea","#efcfde","#312b40","#ba886c","#7b9cc1"],
 ["#ebd4f5","#f8ded0","#664350","#aa795c","#c48fbb"],
 ["#c7e4df","#e9c8ed","#362c36","#d39a78","#82ada4"],
 ["#d6cffa","#e9d7e9","#402e47","#ae735d","#9894bd"],
 ["#e8d8cb","#decfea","#3b303d","#bf866b","#b78fa9"],
 ["#deddf4","#f1cdd6","#4c3442","#d5a07b","#9b91cb"],
 ["#c9d8e8","#f5d4db","#342f41","#b78365","#879bbe"],
 ["#e7d6ef","#f6e0c6","#4b3545","#c99577","#b88cbc"],
 ["#d0e1d8","#eccce5","#44343d","#c18e73","#8cb5aa"]
 ];
 const [bg,rose,hair,skin,coat]=palettes[index%palettes.length];
 const hairStyle=gender==="man"?
 '<path d="M181 312Q153 169 235 141Q277 88 354 132Q452 136 425 300Q398 254 373 237Q286 267 181 312Z" fill="'+hair+'"/>' :
 '<path d="M168 312Q136 146 280 115Q441 102 450 301L451 535Q383 554 358 510L408 301Q291 252 168 312Z" fill="'+hair+'"/>';
 const offset=variation?10:0;
 const pieces=[
 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 760">',
 '<defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="'+bg+'"/><stop offset="1" stop-color="'+rose+'"/></linearGradient>',
 '<linearGradient id="b" x2="1" y2="1"><stop stop-color="'+coat+'"/><stop offset="1" stop-color="'+hair+'"/></linearGradient></defs>',
 '<rect width="600" height="760" fill="url(#a)"/><circle cx="465" cy="146" r="158" fill="#fff" opacity=".19"/>',
 '<path d="M0 640Q140 567 270 650T600 615V760H0" fill="#fff" opacity=".17"/>',
 '<ellipse cx="300" cy="825" rx="283" ry="301" fill="url(#b)"/>',
 '<path d="M231 497L213 632Q299 691 385 628L363 494" fill="'+skin+'"/>',
 '<ellipse cx="'+(300+offset)+'" cy="349" rx="121" ry="172" fill="'+skin+'"/>',
 hairStyle,
 '<path d="M227 353q23-13 48 0m68 0q23-13 48 0" stroke="'+hair+'" stroke-width="7" stroke-linecap="round" fill="none"/>',
 '<path d="M286 411q14 8 29 0" stroke="#925a59" stroke-width="4" stroke-linecap="round" fill="none"/>',
 '<path d="M267 449q33 21 66 0" stroke="#96546a" stroke-width="5" fill="none" stroke-linecap="round"/>',
 '<path d="M128 669Q300 550 470 669" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="17"/>',
 '</svg>'
 ];
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(pieces.join(""));
}

const additional=[
 ["levon","Левон",28,"man","Ереван","Армения","am","serious","музыка|путешествия|кофе|книги","hy|ru|en","Люблю живую музыку, горы и разговоры до рассвета."],
 ["mark","Марк",30,"man","Берлин","Германия","de","relationship","спорт|кино|кофе|природа","de|en","Ценю простые вещи: честность, уют и прогулки под дождём."],
 ["ana","Ана",26,"woman","Барселона","Испания","es","dates","танцы|путешествия|музыка|море","es|en","Танцую, исследую новые города и смеюсь от души."],
 ["alex","Алекс",29,"man","Париж","Франция","fr","friendship","живопись|книги|кино|фотография","fr|en","Ищу интересные знакомства и новые ракурсы города."],
 ["mariam","Мариам",25,"woman","Тбилиси","Грузия","ge","serious","кулинария|книги|путешествия|кофе","ru|en","Люблю большие семейные ужины, доброту и новые открытия."],
 ["daniel","Даниэль",27,"man","Москва","Россия","ru","communication","программирование|фотография|музыка|прогулки","ru|en","Фотографирую город, собираю плейлисты и люблю неожиданные идеи."],
 ["elena","Елена",31,"woman","Краснодар","Россия","ru","relationship","природа|кино|кофе|музыка","ru|en","Ценю маленькие радости и тёплое общение."],
 ["david","Давид",32,"man","Гюмри","Армения","am","undecided","кулинария|путешествия|спорт|языки","hy|ru","Вкусная еда и хорошие беседы — мой любимый план."],
 ["maya","Майя",24,"woman","Лондон","Великобритания","gb","friendship","музыка|книги|танцы|фотография","en","Ищу вдохновение в мелочах и новых знакомых."],
 ["artem","Артём",26,"man","Краснодар","Россия","ru","dates","кино|путешествия|кофе|настольные-игры","ru|en","Люблю спонтанные поездки, игры и смешные истории."]
] as const;

const extraDemoPeople:DemoPerson[]=additional.map((p,i)=>({
 id:p[0],name:p[1],age:p[2],gender:p[3] as DemoPerson["gender"],city:p[4],country:p[5],countryCode:normalizeCountryCode(p[6])??"",
 goal:p[7] as DemoPerson["goal"],interests:p[8].split("|"),languages:p[9].split("|"),about:p[10],
 photos:[{id:p[0]+"-1",src:avatar(i,0,p[3] as DemoPerson["gender"])},
         {id:p[0]+"-2",src:avatar(i,1,p[3] as DemoPerson["gender"])}]
}));
export const forYouDemoPeople:DemoPerson[]=[...demoPeople,...extraDemoPeople];
