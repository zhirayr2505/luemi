import type { BlikAuthor } from '../viewer/blikNavigation';

export type BlikiFeedCandidate = BlikAuthor & {
  isMutualMatch: boolean;
  likedByViewer: boolean;
  isNearby: boolean;
  isSelf: boolean;
  isBlocked: boolean;
  isEligible: boolean;
  lastPublishedAt: number;
};
export type BlikiFeedGroup = 'matches' | 'liked' | 'nearby' | 'world';
export type BlikiFeedEntry = BlikiFeedCandidate & { group: BlikiFeedGroup };
export type BlikiFeedResult = {
  entries: BlikiFeedEntry[];
  worldStartsAt: number | null;
  collapsedAvatars: BlikiFeedEntry[];
};

/** Caller must supply server-authorized, nonexpired stories; this filters again for safety. */
export function buildBlikiFeed(
  candidates: readonly BlikiFeedCandidate[],
  options: { now: number; maxCollapsed?: number },
): BlikiFeedResult {
  const now = options.now;
  if (!Number.isFinite(now)) throw new Error('Invalid feed time');
  const maxCollapsed = Math.max(0, Math.min(4, Math.floor(options.maxCollapsed ?? 4)));
  const seen = new Set<string>();
  const entries: BlikiFeedEntry[] = [];
  for (const candidate of candidates) {
    if (!candidate.id || seen.has(candidate.id) || candidate.isBlocked || !candidate.isEligible ||
      !candidate.stories.length || !Number.isFinite(candidate.lastPublishedAt) ||
      candidate.lastPublishedAt > now || candidate.lastPublishedAt <= now - 86400000) continue;
    const activeStories = candidate.stories.filter(story => {
      const publishedAt = 'publishedAt' in story ? (story as { publishedAt?: unknown }).publishedAt : undefined;
      if (publishedAt === undefined) return false; // Never render stories with unverifiable expiry.
      return typeof publishedAt === 'number' && Number.isFinite(publishedAt) &&
        publishedAt <= now && publishedAt > now - 24 * 60 * 60 * 1000;
    });
    if (!activeStories.length) continue;
    seen.add(candidate.id);
    const group: BlikiFeedGroup = candidate.isMutualMatch ? 'matches'
      : candidate.likedByViewer ? 'liked'
      : candidate.isNearby ? 'nearby' : 'world';
    entries.push({ ...candidate, stories: activeStories, group });
  }
  const priority: Record<BlikiFeedGroup, number> = { matches: 0, liked: 1, nearby: 2, world: 3 };
  entries.sort((a, b) => priority[a.group] - priority[b.group] ||
    b.lastPublishedAt - a.lastPublishedAt || a.id.localeCompare(b.id));
  const worldIndex = entries.findIndex(entry => entry.group === 'world');
  return {
    entries,
    worldStartsAt: worldIndex >= 0 ? worldIndex : null,
    collapsedAvatars: entries.filter(entry => !entry.isSelf).slice(0, maxCollapsed),
  };
}
