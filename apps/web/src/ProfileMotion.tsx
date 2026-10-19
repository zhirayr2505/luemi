import { useRef, type ReactNode } from 'react';
import { ageAt, type Profile } from '../../../packages/core/domain';
import { Icon } from './ui';
import { ProfileGallery } from './ProfileGallery';
import { useProfilePhotoMorph } from './motion/useProfilePhotoMorph';

type Props = { profile: Profile; reducedMotion?: boolean; children?: ReactNode };

/** An independently composited header sits outside ONE native scrolling region. */
export function ProfileMotion({ profile, reducedMotion = false, children }: Props) {
  const scroller = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const compact = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLDivElement>(null);
  useProfilePhotoMorph(
    scroller,
    frame,
    photo,
    compact,
    caption,
    bars,
    profile.id,
    reducedMotion,
  );
  const age = ageAt(profile.birthDate);
  const display = `${profile.name || 'Твоё имя'}${Number.isFinite(age) ? `, ${age}` : ''}`;

  return (
    <div className="profile-detail-root" data-reduced-motion={reducedMotion}>
      <main ref={scroller} className="profile-detail-scroll" aria-label={`Профиль ${display}`}>
        <div className="profile-hero-spacer" aria-hidden="true">
          <span className="profile-snap-open" />
          <span className="profile-snap-closed" />
        </div>
        <div className="profile-motion-details">
          <section className="glass section">
            <h3>О себе</h3>
            <p>{profile.about || 'Здесь появится немного о тебе.'}</p>
          </section>
          <section className="glass section">
            <h3>Интересы</h3>
            <div className="chips colored">
              {profile.interests.length ? (
                profile.interests.map((interest, i) => (
                  <span key={interest} style={{ '--chip-tone': i % 7 } as React.CSSProperties}>
                    {interest}
                  </span>
                ))
              ) : (
                <p>Пока не указаны</p>
              )}
            </div>
          </section>
          <section className="glass section">
            <h3>Языки общения</h3>
            <p>{profile.languages.join(' · ') || 'Не указаны'}</p>
          </section>
        </div>
        {children}
      </main>
      <div className="profile-morph-overlay">
        <div className="profile-morph-frame" ref={frame}>
          <div ref={photo} className="profile-morph-photo" aria-label={`Фотографии: ${display}`}>
            <ProfileGallery
              profile={profile}
              display={display}
              barsRef={bars}
            />
            <div className="profile-morph-scrim" aria-hidden="true" />
            <div ref={caption} className="profile-morph-caption">
              <div className="profile-morph-name">
                {display}
                {profile.verified && (
                  <span className="verified" aria-label="Проверенный профиль">
                    <Icon name="check" size={13} />
                  </span>
                )}
              </div>
              <div className="profile-morph-city">
                {profile.city || 'Город не указан'}
                {profile.goal && profile.goal !== 'Пока не определился' ? ` · ${profile.goal}` : ''}
              </div>
            </div>
          </div>
          <div className="profile-morph-circle-rim" aria-hidden="true" />
          <div className="profile-morph-compact" ref={compact} aria-hidden="true">
            <strong>{display}</strong>
            <span>
              {profile.city || 'LUEMI'}
              {profile.verified ? ' · ✓' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
