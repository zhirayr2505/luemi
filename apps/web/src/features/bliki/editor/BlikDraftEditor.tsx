import { useEffect, useRef, useState } from 'react';
import { listBlikDrafts, deleteBlikDraft } from '../drafts/draftRepository';
import { useBlikDraft } from '../drafts/useBlikDraft';
import type { BlikDraft, BlikLayer } from '../drafts/draftTypes';

type Props = {
  /** Must be the authenticated server-verified user id. */
  ownerId: string;
  onClose: () => void;
  /** Optional integration callback; does not publish on its own. */
  onPreview?: (draftId: string) => void;
};

export function BlikDraftEditor({ ownerId, onClose, onPreview }: Props) {
  const state = useBlikDraft(ownerId);
  const picker = useRef<HTMLInputElement>(null);
  const [existing, setExisting] = useState<BlikDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let active = true;
    listBlikDrafts(ownerId).then(items => {
      if (active) setExisting(items);
    }).catch(() => { if (active) setMessage('Локальное хранилище недоступно'); });
    return () => { active = false; };
  }, [ownerId]);

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try { await state.create(file); setMessage('Черновик сохранён'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Ошибка выбора файла'); }
    finally { setBusy(false); }
  }
  function addLayer(type: BlikLayer['type']) {
    const value = type === 'emoji' ? '💜' : 'Твой момент';
    state.change({ ...state.editor, layers: [...state.editor.layers, {
      id: crypto.randomUUID(), type, value, x: 0.5, y: 0.5,
      scale: 1, rotation: 0, style: 'light',
    }] });
  }
  async function goPreview() {
    setBusy(true);
    try {
      await state.flush();
      setPreview(true);
      if (state.draft) onPreview?.(state.draft.id);
    } catch { setMessage('Не удалось сохранить изменения'); }
    finally { setBusy(false); }
  }
  const frame = (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16',
      background: '#18131e', overflow: 'hidden', borderRadius: 16 }}>
      {state.mediaUrl && (state.draft?.mediaKind === 'image'
        ? <img src={state.mediaUrl} alt="Блик" style={{ width: '100%', height: '100%',
            objectFit: state.editor.fit, transform: `translate(${state.editor.translateX}px, ${state.editor.translateY}px) scale(${state.editor.scale})` }} />
        : <video src={state.mediaUrl} controls playsInline muted={state.editor.muted}
            style={{ width: '100%', height: '100%', objectFit: state.editor.fit }} />)}
      {state.editor.layers.map(layer => <span key={layer.id} style={{
        position: 'absolute', left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${layer.scale}) rotate(${layer.rotation}deg)`,
        color: 'white', fontSize: 22, textShadow: '0 1px 5px #000',
        pointerEvents: 'none', whiteSpace: 'pre-wrap', maxWidth: '85%',
      }}>{layer.value}</span>)}
    </div>
  );
  return (
    <section aria-label="Редактор Блика" style={{ position: 'fixed', inset: 0, zIndex: 2000,
      background: '#16111c', color: '#fff', overflowY: 'auto', padding: 'max(16px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => { void state.flush().catch(() => undefined); onClose(); }}>Закрыть</button>
        <strong>{preview ? 'Предпросмотр' : 'Новый Блик'}</strong>
        <span>{state.saving ? 'Сохранение…' : '💜'}</span>
      </header>
      {message && <p role="status">{message}</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {!state.draft ? <>
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,video/mp4"
          style={{ display: 'none' }} onChange={event => void handleFile(event.target.files?.[0])} />
        <button disabled={busy} onClick={() => picker.current?.click()}>Выбрать из галереи</button>
        {existing.map(item => <div key={item.id} style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={() => void state.recover(item.id).catch(() => setMessage('Черновик повреждён'))}>
            Продолжить · {new Date(item.updatedAt).toLocaleDateString()}
          </button>
          <button onClick={() => void deleteBlikDraft(item.id, ownerId).then(() =>
            setExisting(items => items.filter(d => d.id !== item.id)))}>Удалить</button>
        </div>)}
      </> : <>
        <div style={{ maxWidth: 340, margin: 'auto' }}>{frame}</div>
        {!preview ? <>
          <nav aria-label="Инструменты Блика" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button onClick={() => addLayer('text')}>Текст</button>
            <button onClick={() => addLayer('emoji')}>Эмодзи</button>
            <button onClick={() => state.change({ ...state.editor, fit: state.editor.fit === 'cover' ? 'contain' : 'cover' })}>
              {state.editor.fit === 'cover' ? 'Показать целиком' : 'Заполнить'}
            </button>
            {state.draft.mediaKind === 'video' &&
              <button onClick={() => state.change({ ...state.editor, muted: !state.editor.muted })}>
                {state.editor.muted ? 'Включить звук' : 'Выключить звук'}
              </button>}
          </nav>
          {state.editor.layers.map(layer => <div key={layer.id} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input aria-label={layer.type === 'text' ? 'Текст Блика' : 'Эмодзи Блика'}
              maxLength={150} value={layer.value}
              onChange={event => state.change({ ...state.editor,
                layers: state.editor.layers.map(x => x.id === layer.id ? { ...x, value: event.target.value } : x) })} />
            <button onClick={() => state.change({ ...state.editor,
              layers: state.editor.layers.filter(x => x.id !== layer.id) })}>×</button>
          </div>)}
          <button disabled={busy} onClick={() => void goPreview()}>Предпросмотр</button>
        </> : <>
          <p>Так будет выглядеть твой Блик. Публикация станет доступна после подключения сервера.</p>
          <button onClick={() => setPreview(false)}>Изменить</button>
          <button disabled>Опубликовать (сервер не подключён)</button>
        </>}
      </>}
    </section>
  );
}
