import { LiquidLogo } from './LiquidLogo';
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import type { Photo, Profile } from '../../../packages/core/domain';
import { ageAt } from '../../../packages/core/domain';
import { getMedia } from './storage';
export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const core = [
    'tab-discover',
    'tab-likes',
    'tab-chats',
    'tab-profile',
    'action-save',
    'action-skip',
    'action-special',
    'action-like',
    'action-undo',
    'utility-location',
    'utility-photo-add',
    'utility-microphone',
  ];
  if (core.includes(name))
    return (
      <span className="themed-icon" aria-hidden="true" style={{ width: size, height: size }}>
        <img
          className="icon core-icon icon-light"
          src={'/assets/icons/core/light/' + name + '.svg'}
          width={size}
          height={size}
          alt=""
        />
        <img
          className="icon core-icon icon-dark"
          src={'/assets/icons/core/dark/' + name + '.svg'}
          width={size}
          height={size}
          alt=""
        />
      </span>
    );
  const paths: Record<string, ReactNode> = {
    back: <path d="m15 5-7 7 7 7" />,
    next: <path d="m9 5 7 7-7 7" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    plus: <path d="M12 4v16M4 12h16" />,
    check: <path d="m5 12 4 4 10-10" />,
    filter: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="7" cy="18" r="2" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    send: (
      <>
        <path d="m3 3 18 9-18 9 4-9-4-9ZM7 12h14" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    gift: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M3 7h18v4H3zM12 7v14" />
        <path d="M12 7C2 7 7-2 12 7c5-9 10 0 0 0Z" />
      </>
    ),
    smile: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14q4 5 8 0M8 8v1m8-1v1" />
      </>
    ),
    edit: (
      <>
        <path d="m15 4 5 5-11 11H4v-5L15 4Zm-2 2 5 5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-11v1" />
      </>
    ),
    bell: (
      <>
        <path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4" />
      </>
    ),
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.info}
    </svg>
  );
}
export function Button({
  children,
  onClick,
  variant = '',
  disabled = false,
  type = 'button',
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  label?: string;
}) {
  return (
    <button
      type={type}
      className={'button ' + variant}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}
export function IconButton({
  icon,
  label,
  onClick,
  className = '',
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={'icon-button ' + className}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}
export function Logo() {
  return <LiquidLogo />;
}
export function Portrait({
  photo,
  className = '',
  alt = 'Фото анкеты',
}: {
  photo?: Photo;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true,
      objectURL = '';
    setUrl('');
    if (photo?.source.startsWith('local:'))
      getMedia(photo.source)
        .then((b) => {
          if (b && active) {
            objectURL = URL.createObjectURL(b);
            setUrl(objectURL);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [photo?.source]);
  if (!photo)
    return (
      <div className={'portrait placeholder ' + className}>
        <Icon name="tab-profile" size={48} />
      </div>
    );
  return (
    <div
      className={
        'portrait ' + (photo.source === 'demo' ? photo.position : 'uploaded') + ' ' + className
      }
      role="img"
      aria-label={alt}
    >
      {photo.source === 'demo' ? (
        <img
          src={`/assets/demo/alina-${photo.position?.replace('portrait-', '') || 'main'}.webp`}
          alt=""
          draggable="false"
        />
      ) : url ? (
        <img src={url} alt="" draggable="false" />
      ) : (
        <Icon name="utility-photo-add" />
      )}
    </div>
  );
}
export function Empty({
  kind = 'no-matches',
  title,
  children,
}: {
  kind?: string;
  title: string;
  children?: ReactNode;
}) {
  const ids: Record<string, string> = {
    'no-matches': '01',
    'no-messages': '02',
    'no-one-nearby': '03',
    'connection-error': '04',
    'moderation-pending': '05',
  };
  return (
    <div className="empty">
      <img
        className="icon-light"
        src={`/assets/illustrations/empty-states/light/vectors/LUEMI_${ids[kind]}_${kind}_light_W07_APPROVED.svg`}
        alt=""
      />
      <img
        className="icon-dark"
        src={`/assets/illustrations/empty-states/dark/vectors/LUEMI_${ids[kind]}_${kind}_dark_W07_APPROVED.svg`}
        alt=""
      />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="tabs"
      role="tablist"
      style={
        {
          '--tab-count': items.length,
          '--tab-index': Math.max(0, items.indexOf(value)),
        } as React.CSSProperties
      }
    >
      <span className="tab-indicator" aria-hidden="true" />
      {items.map((i) => (
        <button
          role="tab"
          aria-selected={value === i}
          className={value === i ? 'active' : ''}
          key={i}
          onClick={() => onChange(i)}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
export function ProfileCard({
  profile,
  onOpen,
  full = false,
}: {
  profile: Profile;
  onOpen?: () => void;
  full?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const start = useRef({ x: 0, y: 0 });
  useEffect(() => setIdx(0), [profile.id]);
  const swipe = (e: PointerEvent) => {
    const dx = e.clientX - start.current.x,
      dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5)
      setIdx(
        (i) => (i + (dx < 0 ? 1 : -1) + profile.photos.length) % Math.max(1, profile.photos.length),
      );
  };
  return (
    <article
      className={'profile-card ' + (full ? 'full-card' : '')}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={swipe}
    >
      <Portrait photo={profile.photos[idx % Math.max(profile.photos.length, 1)]} />
      <div className="photo-bars">
        {profile.photos.map((p, i) => (
          <button
            key={p.id}
            aria-label={`Фото ${i + 1}`}
            aria-current={idx === i}
            onClick={() => setIdx(i)}
          >
            <span className={idx === i ? 'current' : ''} />
          </button>
        ))}
      </div>
      <div className="photo-arrows">
        <button
          aria-label="Предыдущее фото"
          onClick={() =>
            setIdx((i) => (i - 1 + profile.photos.length) % Math.max(1, profile.photos.length))
          }
        >
          <Icon name="back" />
        </button>
        <button
          aria-label="Следующее фото"
          onClick={() => setIdx((i) => (i + 1) % Math.max(1, profile.photos.length))}
        >
          <Icon name="next" />
        </button>
      </div>
      <div className="profile-overlay">
        <button className="profile-name" onClick={onOpen} disabled={!onOpen}>
          {profile.name || 'Твоё имя'}
          {Number.isFinite(ageAt(profile.birthDate)) ? ', ' + ageAt(profile.birthDate) : ''}
          {profile.verified && (
            <span className="verified" aria-label="Демонстрационный значок проверки">
              <Icon name="check" size={13} />
            </span>
          )}
        </button>
        <div className="profile-place">
          {profile.country === 'Россия' ? '🇷🇺' : profile.country === 'Армения' ? '🇦🇲' : '🌍'}{' '}
          {profile.city}
          {profile.goal && profile.goal !== 'Пока не определился'
            ? ' · ' + profile.goal.toLowerCase()
            : ''}
        </div>
        <div className="chips photo-chips">
          {profile.interests.slice(0, 2).map((x) => (
            <span key={x}>{x}</span>
          ))}
          {profile.interests.length > 2 && (
            <button onClick={onOpen}>+{profile.interests.length - 2}</button>
          )}
        </div>
        <p>{profile.about}</p>
      </div>
    </article>
  );
}
export function PublicProfile({ profile }: { profile: Profile }) {
  return (
    <div className="public-profile">
      <ProfileCard profile={profile} full />
      <section className="glass section">
        <h3>О себе</h3>
        <p>{profile.about || 'Здесь появится немного о тебе.'}</p>
      </section>
      <section className="glass section">
        <h3>Интересы</h3>
        <div className="chips colored">
          {profile.interests.map((x, i) => (
            <span key={x} style={{ '--chip-tone': i % 7 } as React.CSSProperties}>
              {x}
            </span>
          ))}
        </div>
      </section>
      <section className="glass section">
        <h3>Языки общения</h3>
        <p>{profile.languages.join(' · ') || 'Не указаны'}</p>
      </section>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <IconButton icon="close" label="Закрыть" onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}
