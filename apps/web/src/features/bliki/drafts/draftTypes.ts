/** Bliki V1 local-only draft contracts. No network side effects. */
export type BlikMediaKind = 'image' | 'video';
export type BlikLayer = {
  id: string;
  type: 'text' | 'emoji';
  value: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  style?: 'light' | 'dark' | 'accent';
};
export type BlikEditorState = {
  fit: 'cover' | 'contain';
  scale: number;
  translateX: number;
  translateY: number;
  muted: boolean;
  trimStartMs?: number;
  trimEndMs?: number;
  layers: BlikLayer[];
};
export type BlikDraft = {
  id: string;
  ownerId: string;
  schemaVersion: 1;
  mediaId: string;
  mediaKind: BlikMediaKind;
  mimeType: string;
  originalName: string;
  originalSize: number;
  createdAt: number;
  updatedAt: number;
  revision: number;
  status: 'editing' | 'ready' | 'failed';
  editor: BlikEditorState;
};
export type BlikDraftMedia = {
  id: string;
  ownerId: string;
  blob: Blob;
  size: number;
  mimeType: string;
};
export const defaultBlikEditor = (): BlikEditorState => ({
  fit: 'cover', scale: 1, translateX: 0, translateY: 0,
  muted: false, layers: [],
});
