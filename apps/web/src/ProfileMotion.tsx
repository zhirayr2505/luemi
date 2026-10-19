import { useRef, useState, type ReactNode } from 'react';
import { ageAt, type Profile } from '../../../packages/core/domain';
import { Icon } from './ui';
import { ProfileGallery } from './ProfileGallery';
import { ProfileTabs } from './ProfileTabs';
import { useProfilePhotoMorph } from './motion/useProfilePhotoMorph';
import { PhotoViewer } from './PhotoViewer';

type PhotoAction = 'report' | 'block' | 'share';
type Props = {
  profile: Profile;
  reducedMotion?: boolean;
  children?: ReactNode;
  notify: (message: string) => void;
  onPhotoAction?: (action: PhotoAction) => void;
  viewerInterests?: string[];
};

/** An independently composited header sits outside ONE native scrolling region. */
export function ProfileMotion({
  profile,
  reducedMotion = false,
  children,
  notify,
  onPhotoAction,
  viewerInterests = [],
}: Props) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const scroller = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const compact = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLDivElement>(null);
  useProfilePhotoMorph(scroller, frame, photo, compact, caption, bars, profile.id, reducedMotion);
  const age = ageAt(profile.birthDate);
  const display = `${profile.name || 'Твоё имя'}${Number.isFinite(age) ? `, ${age}` : ''}`;
  const tabsProps = { onOpenPhoto: setViewerIndex, viewerInterests };

  return (
    <div
      className={`profile-detail-root${children ? ' has-profile-action' : ''}`}
      data-reduced-motion={reducedMotion}
    >
      <main ref={scroller} className="profile-detail-scroll" aria-label={`Профиль ${display}`}>
        <div className="profile-hero-spacer" aria-hidden="true">
          <span className="profile-snap-open" />
          <span className="profile-snap-closed" />
        </div>
        <div className="profile-motion-details">
          <ProfileTabs profile={profile} {...tabsProps} />
        </div>
      </main>
      {children && <div className="profile-action-bar">{children}</div>}
      <div className="profile-morph-overlay">
        <div className="profile-morph-frame" ref={frame}>
          <div ref={photo} className="profile-morph-photo" aria-label={`Фотографии: ${display}`}>
            <ProfileGallery
              profile={profile}
              display={display}
              barsRef={bars}
              onOpen={setViewerIndex}
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
          <div className="profile-morph-compact" ref={compact} aria-hidden="true">
            <strong>{display}</strong>
            <span>
              {profile.city || 'LUEMI'}
              {profile.verified ? ' · ✓' : ''}
            </span>
          </div>
        </div>
      </div>
      {viewerIndex !== null && profile.photos[viewerIndex] && (
        <PhotoViewer
          profile={profile}
          initialIndex={viewerIndex}
          reducedMotion={reducedMotion}
          notify={notify}
          onClose={() => setViewerIndex(null)}
          onPhotoAction={(action) => {
            onPhotoAction?.(action);
          }}
        />
      )}
    </div>
  );
}
