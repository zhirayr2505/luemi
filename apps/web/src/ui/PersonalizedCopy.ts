/** A single source of grammatical truth, based on the registered user's own gender.
 * Audience preference is NEVER used for grammatical agreement. */
import type {Gender,Goal} from "../registration/model";

export function gendered(gender:Gender,male:string,female:string,neutral=male):string{
 return gender==="woman"?female:gender==="man"?male:neutral;
}
export function goalLabel(id:Goal|string,gender:Gender=""):string{
 if(id==="undecided")return gendered(gender,"Пока не определился","Пока не определилась","Пока не определено");
 const labels:Record<string,string>={
  serious:"Серьёзные отношения",love:"Найти любовь",relationship:"Отношения",
  family_goal:"Создать семью",dates:"Свидания",friendship:"Дружба",
  communication:"Общение",new_people:"Новые знакомства",flirt:"Лёгкий флирт",
  casual:"Без обязательств",activities:"Совместные активности",travel_partner:"Попутчики"
 };
 return labels[id]??"";
}
export const genderCopy=(gender:Gender)=>({
 ready:gendered(gender,"Ты готов знакомиться?","Ты готова знакомиться?","Готовы знакомиться?"),
 registered:gendered(gender,"Ты зарегистрировался","Ты зарегистрировалась","Регистрация завершена"),
 selected:gendered(gender,"Ты выбрал","Ты выбрала","Выбрано"),
 liked:gendered(gender,"Ты понравился","Ты понравилась","Твой профиль понравился"),
 undecided:goalLabel("undecided",gender)
});
