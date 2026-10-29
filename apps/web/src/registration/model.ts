import {normalizeCountryCode} from "@luemi/contracts";
export type Gender = "" | "man" | "woman" | "other";
export type Audience = "" | "women" | "men" | "everyone";
export type Goal = "" | "serious" | "relationship" | "dates" | "friendship" | "communication" | "undecided";
export type SearchScope = "radius" | "country" | "world";
export const goals = [
 {id:"serious",label:"Серьёзные отношения"},
 {id:"relationship",label:"Отношения"},
 {id:"dates",label:"Свидания"},
 {id:"friendship",label:"Дружба"},
 {id:"communication",label:"Общение"},
 {id:"undecided",label:"Пока не определился"}
] as const;
export interface CitySelection {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  region?: string;
}
export interface RegistrationDraft {
  name: string; trialConsent: boolean;
  day: string; month: string; year: string; gender: Gender;
  country: string; city: string; placeId: string; countryCode: string;
  radius: number; searchScope: SearchScope;
  audience: Audience; ageMin: number; ageMax: number; goal: Goal;
  interests: string[]; about: string; languages: string[];
  // Optional profile details. They never block publication and can be added later.
  height: number | null; occupation: string; education: string;
  lifestyle: string[]; pets: string[]; facts: string[];
}
export const newDraft=(name=""):RegistrationDraft=>({
  name,trialConsent:false,day:"",month:"",year:"",gender:"",
  country:"",city:"",placeId:"",countryCode:"",radius:100,searchScope:"radius",
  audience:"",ageMin:18,ageMax:35,goal:"",
  interests:[],about:"",languages:[],height:null,occupation:"",education:"",
  lifestyle:[],pets:[],facts:[]
});
export const cleanName=(name:string):string=>
  name.normalize("NFC").replace(/[^\p{L}\p{M}'’\- ]/gu,"").slice(0,48);
export function nameValid(name:string):boolean {
  const value=name.trim();
  return value.length>=2&&value.length<=48 &&
    /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(value);
}
export function birthDateValid(day:string,month:string,year:string,today=new Date()):boolean {
  if(!/^\d{1,2}$/.test(day)||!/^\d{1,2}$/.test(month)||!/^\d{4}$/.test(year))return false;
  const y=Number(year),m=Number(month),d=Number(day);
  if(y<1900||m<1||m>12||d<1||d>31)return false;
  const date=new Date(Date.UTC(y,m-1,d));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return false;
  const cutoff=new Date(Date.UTC(today.getUTCFullYear()-18,today.getUTCMonth(),today.getUTCDate()));
  return date.getTime()<=cutoff.getTime();
}
export function selectedCityValid(data:RegistrationDraft):boolean {
  return /^[a-z0-9:_-]{3,180}$/i.test(data.placeId)&&normalizeCountryCode(data.countryCode)!==null&&
    data.country.trim().length>1&&data.city.trim().length>1;
}
export function validateStep(d:RegistrationDraft,step:number,count:number,today=new Date(),mode:"demo"|"live"="demo"):string|null {
  switch(step) {
    case 1:
      if(!nameValid(d.name))return "Имя: 2–48 букв, разрешены пробелы, дефис и апостроф.";
      if(!d.trialConsent)return mode==="live"?"Подтверди условия регистрации.":"Подтверди условия тестового режима.";
      return null;
    case 2:
      if(!birthDateValid(d.day,d.month,d.year,today))return "Укажи настоящую дату рождения. LUEMI доступен с 18 лет.";
      return d.gender?null:"Выбери вариант пола.";
    case 3:
      if(!selectedCityValid(d))return "Выбери город из предложенного списка.";
      return ["radius","country","world"].includes(d.searchScope)&&Number.isInteger(d.radius)&&d.radius>=1&&d.radius<=5000?null:"Радиус: от 1 до 5000 км.";
    case 4:
      if(!d.audience||!goals.some(g=>g.id===d.goal))return "Выбери предпочтения и цель знакомства.";
      return d.ageMin>=18&&d.ageMax<=80&&d.ageMin<=d.ageMax?null:"Проверь диапазон возраста.";
    case 5:return d.interests.length<=15?null:"Максимум 15 интересов.";
    case 6:return [...d.about].length<=750?null:"Максимум 750 символов.";
    case 7:return count<=6?null:"В регистрации доступно до шести фотографий.";
    default:return null;
  }
}
export const steps=[
  {title:"Как тебя зовут?",subtitle:"Начнём с самого приятного — знакомства."},
  {title:"Расскажи о себе",subtitle:"Дата рождения и пол помогают сделать поиск безопаснее."},
  {title:"Где будем искать?",subtitle:"Точное местоположение никому не показываем."},
  {title:"Кого ты ищешь?",subtitle:"Знакомства начинаются с общих намерений."},
  {title:"Что тебе нравится?",subtitle:"Выбери то, что действительно тебе близко."},
  {title:"Пару слов о себе",subtitle:"Без длинных анкет и сложных вопросов."},
  {title:"Твои фотографии",subtitle:"Одна главная фотография и ещё пять мест."},
  {title:"Посмотри на себя",subtitle:"Предварительный вид анкеты до публикации."}
] as const;
