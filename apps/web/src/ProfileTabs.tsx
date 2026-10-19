import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { Profile } from '../../../packages/core/domain';
import { ageAt } from '../../../packages/core/domain';
import { Icon, IconButton, Modal, Portrait } from './ui';

export const PROFILE_TAB_LABELS = ['О себе', 'Блики', 'Фото', 'Аккаунт', 'Подарки'] as const;
type ProfileTabIndex = 0 | 1 | 2 | 3 | 4;

function getTabIndex(value: number): ProfileTabIndex {
  return Math.min(4, Math.max(0, Math.round(value))) as ProfileTabIndex;
}

function AboutTab({ profile }: { profile: Profile }) {
  const goal =
    profile.goal && profile.goal !== 'Пока не определился'
      ? profile.goal
      : 'Пока не определилась цель';
  return (
    <div className="profile-tabs-stack">
      <section className="glass section profile-tab-card">
        <span className="profile-card-eyebrow">ЗНАКОМСТВО</span>
        <h3>О себе</h3>
        <p>{profile.about || 'Здесь появится немного о тебе.'}</p>
      </section>
      <section className="glass section profile-tab-card">
        <span className="profile-card-eyebrow">ТОЧКИ ПРИТЯЖЕНИЯ</span>
        <h3>Интересы</h3>
        {profile.interests.length ? (
          <div className="chips colored">
            {profile.interests.map((interest, index) => (
              <span key={interest} style={{ '--chip-tone': index % 7 } as CSSProperties}>
                {interest}
              </span>
            ))}
          </div>
        ) : (
          <p>Интересы пока не указаны.</p>
        )}
      </section>
      <section className="glass section profile-tab-card profile-goal-card">
        <span className="profile-card-eyebrow">ЧТО ИЩЕТ</span>
        <div className="profile-goal-line">
          <span className="profile-goal-icon" aria-hidden="true">
            <Icon name="tab-likes" size={23} />
          </span>
          <div>
            <h3>Цель знакомства</h3>
            <p>{goal}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyCollection({
  kind,
  title,
  description,
  footnote,
}: {
  kind: 'glint' | 'gift';
  title: string;
  description: string;
  footnote: string;
}) {
  return (
    <div className="glass profile-collection-empty">
      <div
        className={'profile-collection-symbol profile-collection-symbol--' + kind}
        aria-hidden="true"
      >
        {kind === 'gift' ? <Icon name="gift" size={39} /> : <span>✦</span>}
      </div>
      <span className="profile-card-eyebrow">
        {kind === 'gift' ? 'ЗНАКИ ВНИМАНИЯ' : 'СОХРАНЁННЫЕ МГНОВЕНИЯ'}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="profile-collection-footnote">
        <Icon name="info" size={16} />
        <span>{footnote}</span>
      </div>
    </div>
  );
}

function GlintsTab() {
  return (
    <div className="profile-tabs-stack">
      <EmptyCollection
        kind="glint"
        title="Пока нет бликов"
        description="Здесь будут оставаться мгновения, которые человек захочет сохранить в своём профиле."
        footnote="Блики живут 24 часа. Сохранённые автором останутся здесь. Публикации пока не подключены."
      />
    </div>
  );
}

function PhotosTab({ profile }: { profile: Profile }) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [profile.id]);
  const total = profile.photos.length;
  const previous = () =>
    setSelected((index) => (index === null ? null : (index - 1 + total) % total));
  const next = () => setSelected((index) => (index === null ? null : (index + 1) % total));

  return (
    <div className="profile-tabs-stack">
      <section className="glass section profile-tab-card profile-photo-section">
        <div className="profile-tab-section-head">
          <div>
            <span className="profile-card-eyebrow">ГАЛЕРЕЯ</span>
            <h3>Фотографии</h3>
          </div>
          <span className="profile-photo-count">
            {total} {'фото'}
          </span>
        </div>
        {total ? (
          <div className="profile-photo-grid">
            {profile.photos.map((photo, index) => (
              <button
                type="button"
                key={photo.id}
                className="profile-photo-tile"
                aria-label={`Открыть фото ${index + 1} из ${total}`}
                onClick={() => setSelected(index)}
              >
                <Portrait photo={photo} alt={`Фотография ${index + 1}`} />
                <span className="profile-photo-tile-number">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p>Фотографии появятся после заполнения анкеты.</p>
        )}
        <p className="profile-photo-note">Нажми на снимок, чтобы рассмотреть его поближе.</p>
      </section>
      {selected !== null && profile.photos[selected] && (
        <Modal title={`Фотография ${selected + 1} из ${total}`} onClose={() => setSelected(null)}>
          <div className="profile-photo-preview">
            <Portrait photo={profile.photos[selected]} alt={`Фото ${selected + 1} из ${total}`} />
          </div>
          {total > 1 && (
            <div className="profile-photo-preview-actions">
              <IconButton icon="back" label="Предыдущее фото" onClick={previous} />
              <span>
                {selected + 1} / {total}
              </span>
              <IconButton icon="next" label="Следующее фото" onClick={next} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function AccountRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="profile-account-row">
      <span className="profile-account-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="profile-account-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function AccountTab({ profile }: { profile: Profile }) {
  const age = ageAt(profile.birthDate);
  const region = [profile.city, profile.country].filter(Boolean).join(', ') || 'Не указано';
  return (
    <div className="profile-tabs-stack">
      <section className="glass section profile-tab-card">
        <span className="profile-card-eyebrow">ОБ АНКЕТЕ</span>
        <h3>Информация об аккаунте</h3>
        <div className="profile-account-list">
          <AccountRow
            icon="shield"
            label="Проверка"
            value={profile.verified ? 'Анкета с отметкой проверки' : 'Отметки проверки пока нет'}
          />
          <AccountRow icon="globe" label="Местоположение" value={region} />
          <AccountRow
            icon="info"
            label="Возраст"
            value={Number.isFinite(age) ? `${age} лет · 18+` : 'Не указан'}
          />
          <AccountRow
            icon="smile"
            label="Языки общения"
            value={profile.languages.join(', ') || 'Не указаны'}
          />
        </div>
      </section>
      <div className="profile-account-privacy-note">
        <Icon name="lock" size={18} />
        <span>Точные контакты, дата рождения и личные данные здесь не публикуются.</span>
      </div>
    </div>
  );
}

function GiftsTab() {
  return (
    <div className="profile-tabs-stack">
      <EmptyCollection
        kind="gift"
        title="Здесь будет коллекция подарков"
        description="Знаки внимания, которые хочется сохранить на память. Самые особенные можно будет закреплять в профиле."
        footnote="Каталог, отправка и оплата подарков пока не подключены."
      />
    </div>
  );
}

export function ProfileTabs({ profile }: { profile: Profile }) {
  const [active, setActive] = useState<ProfileTabIndex>(0);
  const viewport = useRef<HTMLDivElement>(null);
  const markers = useRef<Array<HTMLSpanElement | null>>([]);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const pending = useRef<number | null>(null);

  // Native scrolling owns motion. Observe 1px-height horizontal markers, not
  // whole panels: a tall panel could otherwise never intersect 60% of its area.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = getTabIndex(Number((visible.target as HTMLElement).dataset.index));
        if (pending.current !== null && index !== pending.current) return;
        pending.current = null;
        setActive(index);
      },
      { root: element, threshold: [0.6, 0.8] },
    );
    for (const marker of markers.current) if (marker) observer.observe(marker);
    return () => observer.disconnect();
  }, [profile.id]);

  const activate = useCallback(
    (index: number) => {
      const next = getTabIndex(index);
      pending.current = active === next ? null : next;
      setActive(next);
      const element = viewport.current;
      if (element) element.scrollLeft = next * element.clientWidth; // click only, never drag / RAF
    },
    [active],
  );

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = active;
    if (event.key === 'ArrowRight') next = getTabIndex(active + 1);
    else if (event.key === 'ArrowLeft') next = getTabIndex(active - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 4;
    else return;
    event.preventDefault();
    activate(next);
    buttons.current[next]?.focus();
  };

  return (
    <section className="profile-tabs-root" aria-label="Разделы профиля">
      <div
        className="profile-tabs-rail"
        role="tablist"
        aria-label="Разделы профиля"
        onKeyDown={keyDown}
      >
        <span className="profile-tabs-glass" aria-hidden="true" />
        {PROFILE_TAB_LABELS.map((label, index) => (
          <button
            type="button"
            key={label}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            id={`profile-tab-${index}`}
            role="tab"
            className={'profile-tabs-tab' + (active === index ? ' is-active' : '')}
            aria-selected={active === index}
            aria-controls={`profile-panel-${index}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => activate(index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="profile-tabs-viewport" ref={viewport} aria-label="Содержимое вкладок профиля">
        {PROFILE_TAB_LABELS.map((label, index) => (
          <div
            key={label}
            id={`profile-panel-${index}`}
            className="profile-tabs-panel"
            data-index={index}
            role="tabpanel"
            aria-labelledby={`profile-tab-${index}`}
            aria-hidden={active !== index}
            inert={active !== index}
          >
            <span
              ref={(element) => {
                markers.current[index] = element;
              }}
              className="profile-tabs-visibility-marker"
              data-index={index}
              aria-hidden="true"
            />
            {index === 0 && <AboutTab profile={profile} />}
            {index === 1 && <GlintsTab />}
            {index === 2 && <PhotosTab profile={profile} />}
            {index === 3 && <AccountTab profile={profile} />}
            {index === 4 && <GiftsTab />}
          </div>
        ))}
      </div>
    </section>
  );
}
