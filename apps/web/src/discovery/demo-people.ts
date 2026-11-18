import type {DemoPerson} from "./model";
import {normalizeCountryCode} from "@luemi/contracts";

/** Synthetic, adult-only QA profiles; zero public discovery records or real users.
 * Portraits are hosted under a server-authenticated, owner-allowlisted API.
 * Nothing from this module ever writes likes, matches, chats, or profile rows.
 * There is deliberately no public CDN fallback: if QA authorization fails,
 * the server answers 404 and the private images do not leak to visitors. */
const base=[
 ["karina","Карина",25,"Краснодар","Россия","ru","relationship","Фотография|Кофе|Путешествия|Музыка","ru|en","Люблю вечерний город, тёплые встречи и внезапные путешествия."],
 ["elina","Элина",24,"Ереван","Армения","am","serious","Кино|Кофе|Искусство|Природа","hy|ru","Вдохновение нахожу в музыке, новых местах и искренних разговорах."],
 ["milana","Милана",27,"Сочи","Россия","ru","dates","Танцы|Кулинария|Кино|Путешествия","ru|en","Обожаю море, прогулки и красивые закаты."],
 ["sara","Сара",26,"Тбилиси","Грузия","ge","communication","Книги|Йога|Музыка|Искусство","ru|en","За живые разговоры, смелые планы и маленькие приключения."],
 ["arpi","Арпи",23,"Гюмри","Армения","am","friendship","Природа|Фотография|Кофе|Прогулки","hy|ru","Счастье для меня — уютный вечер, любимая музыка и добрые люди."],
 ["diana","Диана",28,"Москва","Россия","ru","relationship","Спорт|Дизайн|Книги|Путешествия","ru|en","Мечтаю однажды отправиться в путешествие без обратного билета."]
] as const;

export const demoPeople:DemoPerson[]=base.map(p=>({
 id:"qa-2026-"+p[0],name:p[1],age:p[2],gender:"woman",
 city:p[3],country:p[4],countryCode:normalizeCountryCode(p[5])??p[5],
 goal:p[6],premium:false,verified:false,
 interests:p[7].split("|").map(x=>x.toLocaleLowerCase("ru").replace(/\s+/g,"-")),
 languages:p[8].split("|"),about:p[9],
 photos:Array.from({length:4},(_,index)=>({
  id:"qa-2026-"+p[0]+"-"+(index+1),
  src:"/api/v2/qa/portraits/"+p[0]+"/"+(index+1)+".webp"
 }))
}));
