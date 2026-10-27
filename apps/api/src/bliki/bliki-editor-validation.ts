/**
 * Strictly typed server-side Bliki editor boundary. Only UI-supported fields are
 * accepted; JSON from the browser is never trusted as a render instruction.
 */
export type ServerBlikiLayer = {
  id: string; type: 'text' | 'emoji'; value: string; x: number; y: number;
  scale: number; rotation: number; style: 'light' | 'dark' | 'accent';
};
export type ServerBlikiEditor = {
  fit: 'cover' | 'contain'; scale: number; translateX: number; translateY: number;
  muted: boolean; caption?: string; trimStartMs?: number; trimEndMs?: number;
  layers: ServerBlikiLayer[];
};
function plain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key)) &&
    keys.every(key => required.includes(key) || optional.includes(key));
}
function between(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
export function parseBlikiEditor(value: unknown): ServerBlikiEditor | null {
  if (!plain(value) || !fields(value,
      ['fit', 'scale', 'translateX', 'translateY', 'muted', 'layers'],
      ['trimStartMs', 'trimEndMs', 'caption']) ||
      (value.fit !== 'cover' && value.fit !== 'contain') ||
      !between(value.scale, 1, 4) ||
      !between(value.translateX, -1000, 1000) ||
      !between(value.translateY, -1000, 1000) ||
      typeof value.muted !== 'boolean' ||
      (value.caption !== undefined && (typeof value.caption !== 'string' ||
        [...value.caption].length > 150)) ||
      !Array.isArray(value.layers) || value.layers.length > 20 ||
      (value.trimStartMs !== undefined && !between(value.trimStartMs, 0, 15000)) ||
      (value.trimEndMs !== undefined && !between(value.trimEndMs, 0, 15000)) ||
      (value.trimStartMs !== undefined && value.trimEndMs !== undefined &&
        (value.trimEndMs as number) <= (value.trimStartMs as number))) return null;
  const seen = new Set<string>();
  const layers: ServerBlikiLayer[] = [];
  for (const layer of value.layers) {
    if (!plain(layer) || !fields(layer, ['id', 'type', 'value', 'x', 'y', 'scale', 'rotation'], ['style']) ||
        typeof layer.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(layer.id) ||
        seen.has(layer.id) || (layer.type !== 'text' && layer.type !== 'emoji') ||
        typeof layer.value !== 'string' || [...layer.value].length > 150 ||
        !between(layer.x, 0, 1) || !between(layer.y, 0, 1) ||
        !between(layer.scale, 0.5, 3) || !between(layer.rotation, -180, 180) ||
        (layer.style !== undefined && !['light', 'dark', 'accent'].includes(String(layer.style)))) return null;
    seen.add(layer.id);
    layers.push({ id: layer.id, type: layer.type, value: layer.value,
      x: layer.x, y: layer.y, scale: layer.scale, rotation: layer.rotation,
      style: (layer.style as ServerBlikiLayer['style'] | undefined) ?? 'light' });
  }
  return { fit: value.fit, scale: value.scale, translateX: value.translateX,
    translateY: value.translateY, muted: value.muted, layers,
    ...(value.caption === undefined ? {} : { caption: value.caption as string }),
    ...(value.trimStartMs === undefined ? {} : { trimStartMs: value.trimStartMs as number }),
    ...(value.trimEndMs === undefined ? {} : { trimEndMs: value.trimEndMs as number }) };
}
