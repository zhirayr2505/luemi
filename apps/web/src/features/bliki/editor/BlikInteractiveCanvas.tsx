import { useRef } from 'react';
import type { BlikEditorState, BlikLayer } from '../drafts/draftTypes';

type Props = {
  editor: BlikEditorState;
  mediaKind: 'image' | 'video';
  mediaUrl: string;
  onChange: (next: BlikEditorState) => void;
};
type Gesture = { layerId: string; startX: number; startY: number; x: number; y: number };
export function BlikInteractiveCanvas({ editor, mediaKind, mediaUrl, onChange }: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  function updateLayer(id: string, patch: Partial<BlikLayer>) {
    onChange({ ...editor, layers: editor.layers.map(layer => layer.id === id ? { ...layer, ...patch } : layer) });
  }
  return <div ref={canvas} aria-label="Холст Блика" style={{
    position: 'relative', width: '100%', aspectRatio: '9 / 16',
    background: '#18131e', overflow: 'hidden', borderRadius: 16, touchAction: 'none',
  }}>
    {mediaKind === 'image'
      ? <img src={mediaUrl} alt="Фото Блика" draggable={false} style={{
          width: '100%', height: '100%', objectFit: editor.fit,
          transform: `translate3d(${editor.translateX}px,${editor.translateY}px,0) scale(${editor.scale})`,
        }} />
      : <video src={mediaUrl} playsInline muted={editor.muted} controls
          style={{ width: '100%', height: '100%', objectFit: editor.fit }} />}
    {editor.layers.map(layer => <span key={layer.id}
      onPointerDown={event => {
        event.stopPropagation();
        gesture.current = { layerId: layer.id, startX: event.clientX, startY: event.clientY,
          x: layer.x, y: layer.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const g = gesture.current;
        const bounds = canvas.current?.getBoundingClientRect();
        if (!g || g.layerId !== layer.id || !bounds) return;
        updateLayer(layer.id, {
          x: Math.max(0, Math.min(1, g.x + (event.clientX - g.startX) / bounds.width)),
          y: Math.max(0, Math.min(1, g.y + (event.clientY - g.startY) / bounds.height)),
        });
      }}
      onPointerUp={() => { gesture.current = null; }}
      onPointerCancel={() => { gesture.current = null; }}
      style={{ position: 'absolute', left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
        transform: `translate(-50%,-50%) scale(${layer.scale}) rotate(${layer.rotation}deg)`,
        color: layer.style === 'dark' ? '#18131e' : layer.style === 'accent' ? '#d6a9ff' : '#fff',
        fontSize: 22, textShadow: '0 1px 5px #000', whiteSpace: 'pre-wrap', maxWidth: '85%',
        touchAction: 'none', cursor: 'grab',
      }}>{layer.value}</span>)}
  </div>;
}
