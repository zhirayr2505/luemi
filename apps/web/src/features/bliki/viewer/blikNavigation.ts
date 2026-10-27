/** Pure Bliki navigation, independent from Discovery and Profile Morph gestures. */
export type BlikStory = {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaKind: 'image' | 'video';
  durationMs?: number;
  caption?: string;
};
export type BlikAuthor = { id: string; name: string; stories: BlikStory[] };
export type BlikPosition = { author: number; story: number };
export function nextBlik(authors: BlikAuthor[], at: BlikPosition): BlikPosition | null {
  const current = authors[at.author];
  if (!current) return null;
  if (at.story + 1 < current.stories.length) return { ...at, story: at.story + 1 };
  for (let i = at.author + 1; i < authors.length; i++) {
    if (authors[i].stories.length) return { author: i, story: 0 };
  }
  return null;
}
export function previousBlik(authors: BlikAuthor[], at: BlikPosition): BlikPosition | null {
  if (at.story > 0) return { ...at, story: at.story - 1 };
  for (let i = at.author - 1; i >= 0; i--) {
    if (authors[i].stories.length) return { author: i, story: authors[i].stories.length - 1 };
  }
  return null;
}
export function nextAuthor(authors: BlikAuthor[], at: BlikPosition, direction: -1 | 1): BlikPosition | null {
  for (let i = at.author + direction; i >= 0 && i < authors.length; i += direction) {
    if (authors[i].stories.length) return { author: i, story: 0 };
  }
  return null;
}
