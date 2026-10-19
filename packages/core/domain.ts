export type Photo = { id: string; source: string; position?: string };
export type Profile = {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  country: string;
  city: string;
  radius: number;
  seek: string;
  ageMin: number;
  ageMax: number;
  goal: string;
  interests: string[];
  about: string;
  languages: string[];
  photos: Photo[];
  consent: boolean;
  status: 'draft' | 'pending' | 'approved';
  verified?: boolean;
};
export const blankProfile: Profile = {
  id: 'self',
  name: '',
  birthDate: '',
  gender: '',
  country: 'Россия',
  city: '',
  radius: 50,
  seek: 'Все',
  ageMin: 18,
  ageMax: 40,
  goal: 'Серьёзные отношения',
  interests: [],
  about: '',
  languages: ['Русский'],
  photos: [],
  consent: false,
  status: 'draft',
};
export function ageAt(date: string, now = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const [y, m, d] = date.split('-').map(Number),
    birth = new Date(Date.UTC(y, m - 1, d));
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== m - 1 || birth.getUTCDate() !== d)
    return NaN;
  return (
    now.getUTCFullYear() -
    y -
    Number(now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d))
  );
}
export function validateStep(p: Profile, step: number, now = new Date()): string | null {
  if (step === 1) {
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\s’'-]{0,49}$/u.test(p.name.trim()))
      return 'Введи имя буквами. Дефис и апостроф разрешены.';
    if (!p.consent) return 'Подтверди условия демонстрационного режима.';
  }
  if (step === 2) {
    const age = ageAt(p.birthDate, now);
    if (!Number.isFinite(age) || age < 18 || new Date(p.birthDate) > now)
      return 'Укажи корректную дату рождения. LUEMI доступен с 18 лет.';
    if (!p.gender) return 'Выбери свой пол.';
  }
  if (step === 3 && (!p.country.trim() || !p.city.trim() || p.radius < 1 || p.radius > 1000))
    return 'Укажи страну, город и радиус от 1 до 1000 км.';
  if (step === 4 && (p.ageMin < 18 || p.ageMax < p.ageMin || p.ageMax > 100))
    return 'Проверь возрастной диапазон: от 18 лет, минимум не выше максимума.';
  if (step === 5 && p.interests.length > 15)
    return 'Во время регистрации можно выбрать до 15 интересов.';
  if (step === 6 && p.about.length > 250) return 'В описании должно быть не больше 250 символов.';
  if (step === 7 && (p.photos.length < 3 || p.photos.length > 6))
    return 'Добавь от 3 до 6 фотографий.';
  if (step === 8) {
    for (let s = 1; s < 8; s++) {
      const err = validateStep(p, s, now);
      if (err) return err;
    }
  }
  return null;
}
export function movePhoto(photos: Photo[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= photos.length || to >= photos.length) return photos;
  const next = [...photos];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
export type Message = {
  id: string;
  chatId: string;
  text: string;
  mine: boolean;
  time: string;
  reply?: string;
  reaction?: string;
  edited?: boolean;
  image?: string;
};
export type DemoState = {
  version: 1;
  profile: Profile;
  step: number;
  onboarded: boolean;
  saved: string[];
  liked: string[];
  skipped: string[];
  blocked: string[];
  matches: string[];
  revealed: string[];
  messages: Message[];
  drafts: Record<string, string>;
  theme: 'light' | 'dark' | 'system';
  reducedMotion: boolean;
  paused: boolean;
  history: { id: string; kind: 'like' | 'skip' }[];
  undoUsed: number;
  quotaDate: string;
  reports: { id: string; reason: string; at: string }[];
};
export const demoPhotos: Photo[] = [
  { id: 'demo-1', source: 'demo', position: 'portrait-main' },
  { id: 'demo-2', source: 'demo', position: 'portrait-sunset' },
  { id: 'demo-3', source: 'demo', position: 'portrait-dog' },
];
export const alina: Profile = {
  ...blankProfile,
  id: 'alina',
  name: 'Алина',
  birthDate: '2000-03-18',
  gender: 'Женщина',
  city: 'Краснодар',
  goal: 'Серьёзные отношения',
  interests: ['Кофе', 'Путешествия', 'Книги', 'Море', 'Собаки'],
  about:
    'Люблю море, книги и долгие разговоры. Могу спонтанно уехать встречать рассвет — особенно с хорошей компанией.',
  photos: demoPhotos,
  consent: true,
  status: 'approved',
  verified: true,
};
export const people = [alina];
export function initialState(): DemoState {
  return {
    version: 1,
    profile: structuredClone(blankProfile),
    step: 0,
    onboarded: false,
    saved: [],
    liked: [],
    skipped: [],
    blocked: [],
    matches: [],
    revealed: [],
    messages: [
      { id: 'seed-1', chatId: 'alina', text: 'Привет! 💜', mine: false, time: '11:42' },
      {
        id: 'seed-2',
        chatId: 'alina',
        text: 'Увидела, что ты тоже любишь путешествия. Куда бы отправился?',
        mine: false,
        time: '11:43',
      },
      {
        id: 'seed-3',
        chatId: 'alina',
        text: 'Привет, Алина! Наверное, в горы. Там время будто останавливается.',
        mine: true,
        time: '11:46',
      },
      { id: 'seed-4', chatId: 'alina', text: 'А если поехать вместе?', mine: false, time: '11:48' },
      {
        id: 'seed-5',
        chatId: 'alina',
        text: 'Звучит как отличный план.',
        mine: true,
        time: '11:50',
        reply: 'А если поехать вместе?',
      },
    ],
    drafts: {},
    theme: 'light',
    reducedMotion: false,
    paused: false,
    history: [],
    undoUsed: 0,
    quotaDate: new Date().toISOString().slice(0, 10),
    reports: [],
  };
}
export function takeAction(state: DemoState, id: string, kind: 'like' | 'skip'): DemoState {
  if (state.blocked.includes(id) || state.paused) return state;
  if (state.history.some((x) => x.id === id)) return state;
  return {
    ...state,
    [kind === 'like' ? 'liked' : 'skipped']: [...state[kind === 'like' ? 'liked' : 'skipped'], id],
    matches: kind === 'like' ? [...new Set([...state.matches, id])] : state.matches,
    history: [...state.history, { id, kind }],
  };
}
export function undoAction(state: DemoState): DemoState {
  if (!state.history.length || state.undoUsed >= 3) return state;
  const action = state.history.at(-1)!;
  return {
    ...state,
    history: state.history.slice(0, -1),
    liked: state.liked.filter((x) => x !== action.id),
    skipped: state.skipped.filter((x) => x !== action.id),
    matches: action.kind === 'like' ? state.matches.filter((x) => x !== action.id) : state.matches,
    undoUsed: state.undoUsed + 1,
  };
}
