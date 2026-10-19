export type Gender = "" | "man" | "woman" | "other";
export type Audience = "" | "women" | "men" | "everyone";
export type Goal = "" | "relationship" | "dates" | "friends";

export interface RegistrationDraft {
  name: string;
  trialConsent: boolean;
  day: string;
  month: string;
  year: string;
  gender: Gender;
  country: string;
  city: string;
  radius: number;
  audience: Audience;
  ageMin: number;
  ageMax: number;
  goal: Goal;
  worldwide: boolean;
  interests: string[];
  about: string;
  languages: string[];
}
export const newDraft = (name = ""): RegistrationDraft => ({
  name, trialConsent: false, day: "", month: "", year: "", gender: "",
  country: "", city: "", radius: 100, audience: "", ageMin: 18, ageMax: 35,
  goal: "", worldwide: false, interests: [], about: "", languages: []
});
export function birthDateValid(day: string, month: string, year: string, today = new Date()): boolean {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return false;
  const y = Number(year), m = Number(month), d = Number(day);
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
  const cutoff = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
  return date.getTime() <= cutoff.getTime();
}
export function validateStep(d: RegistrationDraft, step: number, photoCount: number, today = new Date()): string | null {
  switch(step) {
    case 1:
      if (!/^[\p{L}\p{M}'’\- ]{2,48}$/u.test(d.name.trim())) return "Укажи имя от 2 до 48 букв. Допустимы пробелы, дефис и апостроф.";
      if (!d.trialConsent) return "Подтверди условия тестового режима.";
      return null;
    case 2:
      if (!birthDateValid(d.day, d.month, d.year, today)) return "Укажи настоящую дату рождения. LUEMI доступен только с 18 лет.";
      if (!d.gender) return "Выбери вариант пола.";
      return null;
    case 3:
      if (d.country.trim().length < 2 || d.city.trim().length < 2) return "Укажи страну и город вручную.";
      if (!Number.isFinite(d.radius) || d.radius < 1 || d.radius > 1000) return "Радиус должен быть от 1 до 1000 км.";
      return null;
    case 4:
      if (!d.audience || !d.goal) return "Выбери, кого хочешь встретить, и цель знакомства.";
      if (d.ageMin < 18 || d.ageMin > d.ageMax || d.ageMax > 80) return "Проверь желаемый возраст.";
      return null;
    case 5:
      return d.interests.length > 15 ? "Можно выбрать не более 15 интересов." : null;
    case 6:
      return d.about.length > 500 ? "Короткое описание не должно превышать 500 символов в тестовой версии." : null;
    case 7:
      // 3 photos are required for publication, not for a saved draft or preview.
      return photoCount > 6 ? "Можно выбрать не более 6 фотографий." : null;
    default:
      return null;
  }
}
export const steps = [
  {title:"Как тебя зовут?", subtitle:"Начнём с самого приятного — знакомства."},
  {title:"Расскажи о себе", subtitle:"Дата рождения и пол помогают сделать поиск безопаснее."},
  {title:"Где будем искать?", subtitle:"Точное местоположение никому не показываем."},
  {title:"Кого ты ищешь?", subtitle:"Знакомства начинаются с общих намерений."},
  {title:"Что тебе нравится?", subtitle:"Выбери то, что действительно тебе близко."},
  {title:"Пару слов о себе", subtitle:"Без длинных анкет и сложных вопросов."},
  {title:"Твои фотографии", subtitle:"Одна главная фотография и ещё пять мест."},
  {title:"Посмотри на себя", subtitle:"Предварительный вид анкеты до публикации."}
] as const;
