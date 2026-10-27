import { validateBlikiVideoDuration } from './bliki-publication-validation.js';

/**
 * Fail-closed MP4 validation. Duration is read from the movie header, never
 * from browser metadata. Rejects incomplete/fragmented and ambiguous files.
 * This is a metadata gate, not a codec decoder or malware scanner.
 */
export function inspectBlikiMp4(bytes: Uint8Array): { durationMs: number } {
  if (bytes.length < 32 || bytes.length > 100 * 1024 * 1024) throw new Error('invalid_video');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (at: number) => view.getUint32(at, false);
  const u64 = (at: number) => {
    const n = view.getBigUint64(at, false);
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('invalid_video');
    return Number(n);
  };
  let foundFtyp = false, foundMoov = false, foundMdat = false;
  let hasSupportedVideoCodec = false;
  let duration: number | undefined;
  function boxes(start: number, end: number, depth: number): void {
    if (depth > 6) throw new Error('invalid_video');
    let pos = start;
    while (pos < end) {
      if (end - pos < 8) throw new Error('invalid_video');
      const size32 = u32(pos);
      const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
      const header = size32 === 1 ? 16 : 8;
      if (size32 === 1 && end - pos < 16) throw new Error('invalid_video');
      const size = size32 === 1 ? u64(pos + 8) : size32 === 0 ? end - pos : size32;
      if (size < header || size > end - pos) throw new Error('invalid_video');
      const body = pos + header;
      if (depth === 0 && type === 'ftyp') foundFtyp = true;
      if (depth === 0 && type === 'mdat' && size > header) foundMdat = true;
      if (depth === 0 && type === 'moov') {
        if (foundMoov) throw new Error('invalid_video');
        foundMoov = true;
        boxes(body, pos + size, depth + 1);
      }
      if (type === 'mvex' || type === 'moof') throw new Error('fragmented_video_unsupported');
      if (type === 'trak' || type === 'mdia' || type === 'minf' || type === 'stbl') boxes(body, pos + size, depth + 1);
      if (type === 'stsd' && depth >= 2) {
        if (size < header + 16) throw new Error('invalid_video');
        const entries = u32(body + 4);
        let entryPos = body + 8;
        for (let i = 0; i < entries && i < 16; i++) {
          if (entryPos + 8 > pos + size) throw new Error('invalid_video');
          const entrySize = u32(entryPos);
          if (entrySize < 8 || entrySize > pos + size - entryPos) throw new Error('invalid_video');
          const codec = String.fromCharCode(...bytes.subarray(entryPos + 4, entryPos + 8));
          if (codec === 'avc1' || codec === 'avc3') hasSupportedVideoCodec = true;
          entryPos += entrySize;
        }
        if (entries > 16 || entryPos !== pos + size) throw new Error('invalid_video');
      }
      if (depth === 1 && type === 'mvhd') {
        if (duration !== undefined || pos + size - body < 20) throw new Error('invalid_video');
        const version = bytes[body];
        if (version !== 0 && version !== 1) throw new Error('invalid_video');
        const offset = body + (version === 1 ? 20 : 12);
        if (offset + (version === 1 ? 8 : 4) > pos + size) throw new Error('invalid_video');
        const timescale = u32(offset);
        const ticks = version === 1 ? u64(offset + 4) : u32(offset + 4);
        if (!timescale || !ticks) throw new Error('invalid_video');
        duration = Math.round(ticks / timescale * 1000);
      }
      pos += size;
    }
  }
  boxes(0, bytes.length, 0);
  if (!foundFtyp || !foundMoov || !foundMdat || !hasSupportedVideoCodec || !validateBlikiVideoDuration(duration))
    throw new Error('invalid_video_duration');
  return { durationMs: duration! };
}
