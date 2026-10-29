import { canReplyToBliki, canViewBliki, isBlikiActive } from './bliki-policy.js';

export type BlikiStoryAccess = {
  storyId: string;
  authorId: string;
  status: 'uploading' | 'processing' | 'published' | 'rejected' | 'deleted';
  publishedAt: Date | null;
  viewerId: string;
  now: Date;
  viewerEligible: boolean;
  authorEligible: boolean;
  blockedEitherDirection: boolean;
  authorVisibleInDiscovery: boolean;
  isMutualMatch: boolean;
};
export type BlikiAction = 'view' | 'react' | 'reply' | 'report' | 'delete';

/** Server-side final authorization decision; callers must derive flags from DB,
 * never from client input. RLS must independently enforce the same boundaries. */
export function authorizeBlikiAction(action: BlikiAction, item: BlikiStoryAccess): boolean {
  if (!item.storyId || !item.viewerId || !item.authorId) return false;
  if (action === 'delete') return item.viewerId === item.authorId;
  const visible = isBlikiActive({
    status: item.status, publishedAt: item.publishedAt,
    expiresAt: item.publishedAt
      ? new Date(item.publishedAt.getTime() + 24 * 60 * 60 * 1000) : null,
    now: item.now,
  }) && canViewBliki({
    viewerId: item.viewerId, authorId: item.authorId,
    viewerEligible: item.viewerEligible, authorEligible: item.authorEligible,
    blockedEitherDirection: item.blockedEitherDirection,
    authorVisibleInDiscovery: item.authorVisibleInDiscovery,
  });
  if (!visible) return false;
  if (action === 'reply') return canReplyToBliki({
    viewerId: item.viewerId, authorId: item.authorId,
    isMutualMatch: item.isMutualMatch, blockedEitherDirection: item.blockedEitherDirection,
  });
  if (action === 'react') return item.viewerId !== item.authorId;
  if (action === 'report') return item.viewerId !== item.authorId;
  return action === 'view';
}
