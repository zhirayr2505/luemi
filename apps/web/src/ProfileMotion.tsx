import { useRef } from 'react';
import { ageAt, type Profile } from '../../../packages/core/domain';
import { Icon, Portrait } from './ui';
import { useProfilePhotoMorph } from './motion/useProfilePhotoMorph';

/** Onboarding preview intentionally keeps its original, static approved layout. */
export function ProfileMotion({ profile, reducedMotion = false }: { profile: Profile; reducedMotion?: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const compact = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  useProfilePhotoMorph(stage, photo, compact, caption, profile.id, reducedMotion);
  const age = ageAt(profile.birthDate);
  const display = `${profile.name || 'Твоё имя'}${Number.isFinite(age) ? ', ' + age : ''}`;
  return <div className="public-profile public-profile--motion">
    <div ref={stage} className="profile-morph-stage" data-collapsed="false">
      <div ref={photo} className="profile-morph-photo">
        <Portrait photo={profile.photos[0]} alt={`Фотография: ${display}`} />
        <div className="profile-morph-scrim" aria-hidden="true" />
        <div ref={caption} className="profile-morph-caption">
          <div className="profile-morph-name">{display}{profile.verified && <span className="verified" aria-label="Проверенный профиль"><Icon name="check" size={13} /></span>}</div>
          <div className="profile-morph-city">{profile.city || 'Город не указан'}{profile.goal && profile.goal !== 'Пока не определился' ? ` · ${profile.goal}` : ''}</div>
        </div>
      </div>
      <div ref={compact} className="profile-morph-compact" aria-hidden="true">
        <strong>{display}</strong>
        <span>{profile.city || 'LUEMI'}{profile.verified ? ' · ✓' : ''}</span>
      </div>
    </div>
    <div className="profile-motion-details">
      <section className="glass section"><h3>О себе</h3><p>{profile.about || 'Здесь появится немного о тебе.'}</p></section>
      <section className="glass section"><h3>Интересы</h3><div className="chips colored">{profile.interests.length ? profile.interests.map((x, i) => <span key={x} style={{ '--chip-tone': i % 7 } as React.CSSProperties}>{x}</span>) : <p>Пока не указаны</p>}</div></section>
      <section className="glass section"><h3>Языки общения</h3><p>{profile.languages.join(' · ') || 'Не указаны'}</p></section>
    </div>
  </div>;
}