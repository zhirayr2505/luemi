import { SlideSwap } from './motion/SlideDeck';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  type DemoState,
  type Profile,
  demoPhotos,
  movePhoto,
  validateStep,
} from '../../../packages/core/domain';
import { putMedia, preparePhoto } from './storage';
import { Button, Icon, IconButton, Logo, Portrait, PublicProfile } from './ui';
const STEP_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8'];
const titles = [
  '',
  'Как тебя зовут?',
  'Давай познакомимся',
  'Ты где-то рядом',
  'Кого хочешь встретить?',
  'Что тебя вдохновляет?',
  'Немного о тебе',
  'Твои фотографии',
  'Вот так тебя увидят',
];
const subtitles = [
  '',
  'Всё начинается с простого знакомства.',
  'Только настоящие знакомства, только 18+.',
  'Укажи город — точный адрес никто не увидит.',
  'Выбирай то, что важно именно тебе.',
  'Общие увлечения помогают начать разговор.',
  'Пара слов, с которых начнётся разговор.',
  'Добавь от 3 до 6 фото, чтобы тебя легче было узнать.',
  'Твой профиль. Твои фотографии. Твоя история.',
];
const groups: Record<string, string[]> = {
  Популярное: ['Кофе', 'Путешествия', 'Музыка', 'Кино', 'Книги', 'Море', 'Собаки', 'Прогулки'],
  Впечатления: [
    'Горы',
    'Походы',
    'Фотография',
    'Закаты',
    'Театр',
    'Музеи',
    'Концерты',
    'Спонтанность',
  ],
  Жизнь: [
    'Готовка',
    'Семья',
    'Психология',
    'Искусство',
    'Дизайн',
    'Технологии',
    'Кошки',
    'Садоводство',
  ],
  Движение: ['Бег', 'Фитнес', 'Танцы', 'Бокс', 'Йога', 'Велосипед', 'Плавание', 'Футбол'],
};
export function Onboarding({
  state,
  setState,
  onClose,
  notify,
}: {
  state: DemoState;
  setState: Dispatch<SetStateAction<DemoState>>;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const p = state.profile,
    step = state.step;
  const [error, setError] = useState(''),
    [category, setCategory] = useState('Популярное'),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(-1);
  const file = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null),
    yearRef = useRef<HTMLInputElement>(null);
  const drag = useRef(-1);
  const [dateParts, setDateParts] = useState(() => {
    const [y = '', m = '', d = ''] = p.birthDate.split('-');
    return { y, m, d };
  });
  const update = (value: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...value } }));
    setError('');
  };
  function setStep(n: number) {
    setState((s) => ({ ...s, step: n }));
    setError('');
  }
  function next() {
    const err = validateStep(p, step);
    if (err) {
      setError(err);
      return;
    }
    if (step === 8) {
      setState((s) => ({ ...s, onboarded: true, profile: { ...s.profile, status: 'pending' } }));
      notify('Анкета сохранена на этом устройстве. Серверная проверка ещё не подключена.');
      onClose();
    } else setStep(step + 1);
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    let photos = [...p.photos];
    for (const f of Array.from(files).slice(0, 6 - photos.length)) {
      try {
        const source = await putMedia(await preparePhoto(f));
        photos.push({ id: crypto.randomUUID(), source });
        update({ photos: [...photos] });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось добавить фото.');
      }
    }
    setBusy(false);
    if (file.current) file.current.value = '';
  }
  function changeDate(key: 'd' | 'm' | 'y', value: string) {
    const parts = { ...dateParts, [key]: value.replace(/\D/g, '').slice(0, key === 'y' ? 4 : 2) };
    setDateParts(parts);
    update({
      birthDate: `${parts.y.padStart(4, '0')}-${parts.m.padStart(2, '0')}-${parts.d.padStart(2, '0')}`,
    });
    if (key === 'd' && parts.d.length === 2) monthRef.current?.focus();
    if (key === 'm' && parts.m.length === 2) yearRef.current?.focus();
    if (key === 'y' && parts.y.length === 4) yearRef.current?.blur();
  }
  if (step === 0)
    return (
      <div className="welcome">
        <div className="welcome-top">
          <Logo />
          <IconButton icon="close" label="Вернуться в приложение" onClick={onClose} />
        </div>
        <img
          className="welcome-art"
          src="/assets/illustrations/empty-states/light/vectors/LUEMI_01_no-matches_light_W07_APPROVED.svg"
          alt=""
        />
        <div className="eyebrow">ТАМ, ГДЕ НАЧИНАЕТСЯ ВЗАИМНОСТЬ</div>
        <h1>
          Твои люди.
          <br />
          Твоя история.
        </h1>
        <p>
          Чуть больше общего.
          <br />
          Чуть ближе друг к другу.
        </p>
        <Button variant="primary wide" onClick={() => setStep(1)}>
          Начать <Icon name="next" />
        </Button>
        <p className="caption">Демонстрационная регистрация. Данные остаются на этом устройстве.</p>
      </div>
    );
  return (
    <div className="wizard">
      <div className="wizard-top">
        <IconButton icon="close" label="Сохранить черновик и закрыть" onClick={onClose} />
        <Logo />
        <span className="draft-label">Черновик</span>
      </div>
      <div className="progress" aria-label="Прогресс регистрации">
        <span style={{ width: `${(step / 8) * 100}%` }} />
      </div>
      <SlideSwap active={String(step)} order={STEP_ORDER} flow={false} className="wizard-stage">
        <div className="wizard-scroll">
          <h1>{titles[step]}</h1>
          <p className="subtitle">{subtitles[step]}</p>
          {step === 1 && (
            <>
              <label className="field">
                Твоё имя
                <input
                  value={p.name}
                  autoComplete="given-name"
                  placeholder="Как к тебе обращаться?"
                  maxLength={50}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <div className="note">
                <Icon name="shield" />
                <p>
                  В демоверсии мы не запрашиваем номер телефона и не отправляем данные на сервер.
                </p>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={p.consent}
                  onChange={(e) => update({ consent: e.target.checked })}
                />
                <span>Я понимаю, что это локальная демонстрация. Мои данные не публикуются.</span>
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <label className="field">Дата рождения</label>
              <div className="date-inputs">
                <input
                  aria-label="День рождения"
                  inputMode="numeric"
                  placeholder="ДД"
                  value={dateParts.d}
                  onChange={(e) => changeDate('d', e.target.value)}
                />
                <span>/</span>
                <input
                  ref={monthRef}
                  aria-label="Месяц рождения"
                  inputMode="numeric"
                  placeholder="ММ"
                  value={dateParts.m}
                  onChange={(e) => changeDate('m', e.target.value)}
                />
                <span>/</span>
                <input
                  ref={yearRef}
                  aria-label="Год рождения"
                  inputMode="numeric"
                  placeholder="ГГГГ"
                  value={dateParts.y}
                  onChange={(e) => changeDate('y', e.target.value)}
                />
              </div>
              <label className="field">Твой пол</label>
              <div className="choice-row">
                {['Мужчина', 'Женщина'].map((x, i) => (
                  <button
                    key={x}
                    className={'choice ' + (p.gender === x ? 'selected' : '')}
                    onClick={() => update({ gender: x })}
                  >
                    <span>{i === 0 ? '♂' : '♀'}</span>
                    {x}
                  </button>
                ))}
              </div>
              <p className="caption">Возраст будет рассчитан автоматически.</p>
            </>
          )}
          {step === 3 && (
            <>
              <label className="field">
                Страна
                <select
                  value={p.country}
                  onChange={(e) => update({ country: e.target.value, city: '' })}
                >
                  <option>Россия</option>
                  <option>Армения</option>
                  <option>Германия</option>
                  <option>Грузия</option>
                  <option>Другая страна</option>
                </select>
              </label>
              <label className="field">
                Город
                <input
                  value={p.city}
                  list="cities"
                  placeholder="Начни вводить название"
                  onChange={(e) => update({ city: e.target.value })}
                />
                <datalist id="cities">
                  {[
                    'Краснодар',
                    'Москва',
                    'Санкт-Петербург',
                    'Сочи',
                    'Ереван',
                    'Гюмри',
                    'Тбилиси',
                    'Берлин',
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </datalist>
              </label>
              <Button
                variant="soft wide"
                onClick={() =>
                  notify(
                    'Автоопределение подключим вместе с геосервисом. Сейчас выбери город вручную.',
                  )
                }
              >
                <Icon name="utility-location" /> Моё местоположение
              </Button>
              <label className="field range-label">
                Радиус поиска <strong>{p.radius} км</strong>
                <input
                  type="range"
                  min="1"
                  max="1000"
                  value={p.radius}
                  onChange={(e) => update({ radius: +e.target.value })}
                />
              </label>
              <div className="note">
                <Icon name="lock" />
                <p>В профиле виден город. Точные координаты не отображаются.</p>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <label className="field">Хочу встретить</label>
              <div className="segmented">
                {['Мужчин', 'Женщин', 'Все'].map((x) => (
                  <button
                    key={x}
                    className={p.seek === x ? 'active' : ''}
                    onClick={() => update({ seek: x })}
                  >
                    {x === 'Все' ? 'Всех' : x}
                  </button>
                ))}
              </div>
              <label className="field range-label">
                Возраст{' '}
                <strong>
                  {p.ageMin}–{p.ageMax}
                </strong>
                <input
                  aria-label="Минимальный возраст"
                  type="range"
                  min="18"
                  max="100"
                  value={p.ageMin}
                  onChange={(e) => update({ ageMin: Math.min(+e.target.value, p.ageMax) })}
                />
                <input
                  aria-label="Максимальный возраст"
                  type="range"
                  min="18"
                  max="100"
                  value={p.ageMax}
                  onChange={(e) => update({ ageMax: Math.max(+e.target.value, p.ageMin) })}
                />
              </label>
              <label className="field">Цель знакомства</label>
              <div className="choice-list">
                {['Серьёзные отношения', 'Общение и дружба', 'Свидания', 'Пока не определился'].map(
                  (x) => (
                    <button
                      key={x}
                      className={p.goal === x ? 'selected' : ''}
                      onClick={() => update({ goal: x })}
                    >
                      {x}
                      <span>
                        {p.goal === x ? <Icon name="check" /> : <span className="radio" />}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <div className="selected-interests">
                <strong>
                  Выбрано <span>{p.interests.length} / 15</span>
                </strong>
                <div className="chips colored">
                  {p.interests.map((x) => (
                    <button
                      key={x}
                      onClick={() => update({ interests: p.interests.filter((t) => t !== x) })}
                    >
                      {x} ×
                    </button>
                  ))}
                  {!p.interests.length && <small>То, о чём ты можешь говорить часами</small>}
                </div>
              </div>
              <div className="category-tabs">
                {Object.keys(groups).map((x) => (
                  <button
                    className={x === category ? 'active' : ''}
                    key={x}
                    onClick={() => setCategory(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="chips interest-grid">
                {groups[category].map((x, i) => (
                  <button
                    key={x}
                    className={p.interests.includes(x) ? 'selected' : ''}
                    onClick={() => {
                      if (p.interests.includes(x))
                        update({ interests: p.interests.filter((t) => t !== x) });
                      else if (p.interests.length < 15) update({ interests: [...p.interests, x] });
                      else notify('Можно выбрать до 15 интересов.');
                    }}
                  >
                    <span>{['✦', '♡', '☀', '♫', '✧', '☕', '❋', '☾'][i % 8]}</span>
                    {x}
                    {p.interests.includes(x) && <Icon name="check" size={15} />}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 6 && (
            <>
              <label className="field">
                Что делает тебя тобой?
                <textarea
                  value={p.about}
                  rows={5}
                  maxLength={250}
                  placeholder="Например: знаю, где лучший кофе, и всегда выбираю дорогу к морю…"
                  onChange={(e) => update({ about: e.target.value })}
                />
                <span className="character-count">{p.about.length} / 250</span>
              </label>
              <div className="emoji-row">
                {['💜', '✨', '☕', '🌊', '🏔️', '🐾', '🎵', '📚'].map((x) => (
                  <button
                    aria-label={`Добавить ${x}`}
                    key={x}
                    onClick={() => update({ about: (p.about + x).slice(0, 250) })}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <label className="field">Языки общения</label>
              <div className="chips">
                {['Русский', 'Հայերեն', 'English', 'Deutsch', 'ქართული'].map((x) => (
                  <button
                    key={x}
                    className={p.languages.includes(x) ? 'selected' : ''}
                    onClick={() =>
                      update({
                        languages: p.languages.includes(x)
                          ? p.languages.filter((t) => t !== x)
                          : [...p.languages, x],
                      })
                    }
                  >
                    {x}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 7 && (
            <>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => void upload(e.target.files)}
              />
              <div className="photo-mosaic">
                {Array.from({ length: 6 }, (_, i) => {
                  const photo = p.photos[i];
                  return (
                    <button
                      key={photo?.id || 'empty' + i}
                      className={'photo-slot slot-' + i + (selected === i ? ' selected' : '')}
                      aria-label={
                        photo
                          ? `Фотография ${i + 1}, изменить`
                          : i === p.photos.length
                            ? 'Добавить фотографии'
                            : `Пустое место ${i + 1}`
                      }
                      draggable={!!photo}
                      onDragStart={() => {
                        drag.current = i;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (photo) update({ photos: movePhoto(p.photos, drag.current, i) });
                      }}
                      onClick={() =>
                        photo ? setSelected(i) : i === p.photos.length && file.current?.click()
                      }
                      disabled={!photo && (i !== p.photos.length || busy)}
                    >
                      {photo ? (
                        <>
                          <Portrait photo={photo} />
                          {i === 0 && <span className="main-photo-label">★ Главное фото</span>}
                        </>
                      ) : i === p.photos.length ? (
                        <span className="photo-plus">
                          <Icon name="plus" size={38} />
                        </span>
                      ) : (
                        <Icon name="utility-photo-add" size={35} />
                      )}
                    </button>
                  );
                })}
              </div>
              {selected >= 0 && p.photos[selected] && (
                <div className="photo-tools">
                  <Button
                    variant="soft"
                    onClick={() => {
                      update({ photos: movePhoto(p.photos, selected, 0) });
                      setSelected(0);
                    }}
                  >
                    Сделать главной
                  </Button>
                  <IconButton
                    icon="back"
                    label="Переместить фото влево"
                    disabled={selected === 0}
                    onClick={() => {
                      update({ photos: movePhoto(p.photos, selected, selected - 1) });
                      setSelected(selected - 1);
                    }}
                  />
                  <IconButton
                    icon="next"
                    label="Переместить фото вправо"
                    disabled={selected === p.photos.length - 1}
                    onClick={() => {
                      update({ photos: movePhoto(p.photos, selected, selected + 1) });
                      setSelected(selected + 1);
                    }}
                  />
                  <IconButton
                    icon="close"
                    label="Удалить фото"
                    onClick={() => {
                      update({ photos: p.photos.filter((_, i) => i !== selected) });
                      setSelected(-1);
                    }}
                  />
                </div>
              )}
              <p className="photo-count">
                <Icon name="check" /> {p.photos.length} из 6 фото добавлены
              </p>
              <p className="caption">Нажми на фото, чтобы изменить порядок, или перетащи его.</p>
              {!p.photos.length && (
                <button
                  className="text-button"
                  onClick={() =>
                    update({ photos: demoPhotos.map((x) => ({ ...x, id: crypto.randomUUID() })) })
                  }
                >
                  Использовать фото из утверждённого макета
                </button>
              )}
              <div className="note">
                <Icon name="lock" />
                <p>
                  В этой сборке фото хранятся только на устройстве. Перед реальной публикацией
                  потребуется проверка.
                </p>
              </div>
              {busy && <p role="status">Подготавливаем фотографии…</p>}
            </>
          )}
          {step === 8 && (
            <>
              <PublicProfile profile={p} />
              <div className="edit-steps">
                {['Имя', 'Возраст', 'Город', 'Поиск', 'Интересы', 'О себе', 'Фото'].map((x, i) => (
                  <button key={x} onClick={() => setStep(i + 1)}>
                    <Icon name="edit" size={15} />
                    {x}
                  </button>
                ))}
              </div>
              <p className="note">
                Это твой реальный предпросмотр на локальных данных. Публикация и модерация ещё не
                подключены.
              </p>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </SlideSwap>
      <footer className="wizard-footer">
        <IconButton icon="back" label="Назад" onClick={() => setStep(step - 1)} />
        <span>
          {step === 7 ? (
            'Все фото можно отредактировать позже'
          ) : step === 8 ? (
            'Сохранить анкету'
          ) : step === 5 || step === 6 ? (
            <button className="text-button" onClick={next}>
              Пропустить
            </button>
          ) : (
            'Твой черновик сохранится'
          )}
        </span>
        <IconButton
          icon="next"
          label={step === 8 ? 'Сохранить анкету' : 'Далее'}
          className="gradient"
          onClick={next}
          disabled={busy}
        />
      </footer>
    </div>
  );
}
