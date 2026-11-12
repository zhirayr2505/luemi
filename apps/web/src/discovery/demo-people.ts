import type {DemoPerson} from "./model";
import {normalizeCountryCode} from "@luemi/contracts";
/** All fifteen cover portraits are AI-generated stock illustrations rendered
 * photographically; the demo badges clearly distinguish them from members.
 * Never interleave cartoon portraits, real people, or other faces into a card.
 * Remote sources are a temporary QA fixture: eventual branded media should
 * be versioned in an approved asset pipeline. */
const portraitSources=[
 "https://cdn.pixabay.com/photo/2024/07/07/19/47/ai-generated-8879550_1280.jpg",
 "https://cdn.pixabay.com/photo/2025/04/18/05/26/ai-generated-9541651_1280.jpg",
 "https://cdn.pixabay.com/photo/2026/01/01/12/33/ai-generated-10046459_1280.jpg",
 "https://cdn.pixabay.com/photo/2026/02/07/12/42/atal07-ultra-realistic-portrait-10109677_1280.jpg",
 "https://cdn.pixabay.com/photo/2023/12/09/19/09/ai-generated-8439990_1280.jpg",
 "https://cdn.pixabay.com/photo/2023/10/21/08/58/ai-generated-8331057_1280.jpg",
 "https://cdn.pixabay.com/photo/2024/06/23/18/53/ai-generated-8848610_1280.jpg",
 "https://cdn.pixabay.com/photo/2024/10/18/13/57/ai-generated-9130482_1280.png",
 "https://cdn.pixabay.com/photo/2024/04/17/14/53/ai-generated-8702249_1280.jpg",
 "https://cdn.pixabay.com/photo/2024/09/01/04/54/ai-generated-9012920_1280.jpg",
 "https://cdn.pixabay.com/photo/2024/12/07/21/00/ai-generated-9251653_1280.png",
 "https://cdn.pixabay.com/photo/2024/11/15/01/18/ai-generated-9198043_1280.jpg",
 "https://cdn.pixabay.com/photo/2024/10/04/15/06/ai-generated-9096614_1280.png",
 "https://cdn.pixabay.com/photo/2026/03/14/22/11/feygrace-woman-10174397_1280.jpg",
 "https://cdn.pixabay.com/photo/2025/02/07/06/42/ai-generated-9389099_1280.jpg"
] as const;
/** Realistic environment photos only. Secondary media may show a place, not
 * a different person's face; if loading fails, reuse the SAME cover portrait. */
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
 ["marko","Марк",28,"man","Краснодар","Россия","ru","relationship","Спорт|Кино|Путешествия|Кофе","ru|en","Люблю горы, велосипеды и импровизированные поездки на выходные."],
 ["maria","Мария",23,"woman","Сочи","Россия","ru","dates","Танцы|Море|Фотография|Природа","ru|en","Обожаю закаты у моря, спонтанные прогулки и искренние улыбки."],
 ["aram","Арам",30,"man","Гюмри","Армения","am","friendship","Музыка|Технологии|Книги|Путешествия","hy|ru","Люблю живые концерты, добрый юмор и содержательные разговоры."],
 ["eva","Ева",25,"woman","Тбилиси","Грузия","ge","communication","Искусство|Кино|Кофе|Йога","ru|en","Мечтаю однажды открыть маленькую кофейню с книжной полкой."],
 ["dav","Давид",27,"man","Москва","Россия","ru","family_goal","Кулинария|Спорт|Путешествия|Прогулки","ru|en","Умею приготовить отличный завтрак и найти красивые маршруты по городу."],
 ["selin","Селин",24,"woman","Стамбул","Турция","tr","dates","Дизайн|Книги|Искусство|Танцы","tr|en","Люблю старинные улочки, вечерний свет и новые открытия."],
 ["ani","Ани",29,"woman","Ванадзор","Армения","am","serious","Книги|Кофе|Природа|Фотография","hy|ru","Мне нравятся тихие места, смелые планы и люди, которые держат слово."],
 ["leo","Лео",31,"man","Амстердам","Нидерланды","nl","undecided","Технологии|Велосипед|Музыка|Кино","en|nl","За хороший разговор и неожиданные путешествия без расписания."]
] as const;
export const demoPeople:DemoPerson[]=base.map((p,index)=>({
 id:p[0],name:p[1],age:p[2],gender:p[3] as DemoPerson["gender"],city:p[4],country:p[5],countryCode:normalizeCountryCode(p[6])??"",
 goal:p[7] as DemoPerson["goal"],premium:false,interests:p[8].split("|").map(x=>x.toLocaleLowerCase("ru").replace(/\s+/g,"-")),
 languages:p[9].split("|"),about:p[10],
 // A clearly labelled fictional card demonstrates long-form scrolling and optional facts.
 ...(index===0?{heightCm:168,occupation:"Дизайнер",facts:[{label:"Любимое место",value:"Кофейни у моря"}],
  answers:[{question:"Идеальный выходной?",answer:"Долгая прогулка, вкусный завтрак и разговоры без спешки."},
   {question:"Что меня вдохновляет?",answer:"Новые города, музыка и тёплые встречи с друзьями."},
   {question:"Что ценю в людях?",answer:"Искренность, чувство юмора и умение слушать."}]}:{}),
 photos:[
  {id:p[0]+"-1",src:portraitSources[index]},
  ...scenes[index%scenes.length].slice(0,2).map((id,variation)=>({
   id:p[0]+"-"+(variation+2),
   src:sceneUrl(id),fallback:portraitSources[index]
  }))
 ]


}));
