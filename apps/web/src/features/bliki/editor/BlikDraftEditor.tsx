import { publishBlikDraftPersisted, type BlikPublishTransport } from '../publishing/blikPublishClient';
import { useEffect, useRef, useState } from 'react';
import { listBlikDrafts, deleteBlikDraft } from '../drafts/draftRepository';
import { useBlikDraft } from '../drafts/useBlikDraft';
import { BlikInteractiveCanvas } from './BlikInteractiveCanvas';
import type { BlikDraft, BlikLayer } from '../drafts/draftTypes';

type Props = {
  /** Must be the authenticated server-verified user id. */
  ownerId: string;
  onClose: () => void;
  /** Optional integration callback; does not publish on its own. */
  onPreview?: (draftId: string) => void;
  /** Only pass after the authenticated publication API is actually available. */
  publishTransport?: BlikPublishTransport;
  onPublished?: (storyId: string) => void;
};

export function BlikDraftEditor({ ownerId, onClose, onPreview, publishTransport, onPublished }: Props) {
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
  async function publish() {
    if (!publishTransport || !state.draft || busy) return;
    setBusy(true);
    setMessage('Публикуем Блик…');
    try {
      await state.flush();
      const result = await publishBlikDraftPersisted(ownerId, state.draft.id, publishTransport);
      if (result.state === 'published') {
        setMessage('Блик опубликован');
        onPublished?.(result.storyId);
      } else setMessage('Блик обрабатывается. Можно проверить публикацию позже.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось опубликовать Блик');
    } finally { setBusy(false); }
  }
  const frame = state.mediaUrl && state.draft
    ? <BlikInteractiveCanvas editor={state.editor} mediaKind={state.draft.mediaKind}
        mediaUrl={state.mediaUrl} onChange={state.change} />
    : null;
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
          {state.draft.mediaKind === 'image' && <label>
            Масштаб <input type="range" min="1" max="4" step="0.05" value={state.editor.scale}
              onChange={event => state.change({ ...state.editor, scale: Number(event.target.value) })} />
          </label>}
          {state.draft.mediaKind === 'video' && <div style={{ display: 'flex', gap: 8 }}>
            <label>Начало (сек) <input type="number" min="0" max="14" step="0.1"
              value={(state.editor.trimStartMs ?? 0) / 1000}
              onChange={event => state.change({ ...state.editor, trimStartMs: Math.max(0, Number(event.target.value) * 1000) })} /></label>
            <label>Конец (сек) <input type="number" min="1" max="15" step="0.1"
              value={(state.editor.trimEndMs ?? 15000) / 1000}
              onChange={event => state.change({ ...state.editor, trimEndMs: Math.min(15000, Number(event.target.value) * 1000) })} /></label>
          </div>}
          <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
            Подпись к Блику
            <textarea rows={2} maxLength={300} value={state.editor.caption ?? ''}
              onChange={event => state.change({ ...state.editor, caption: Array.from(event.target.value).slice(0, 150).join('') })}
              placeholder="Добавь подпись…" aria-label="Подпись Блика" />
            <small>{[...(state.editor.caption ?? '')].length}/150</small>
          </label>
          {state.editor.layers.map(layer => <div key={layer.id} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input aria-label={layer.type === 'text' ? 'Текст Блика' : 'Эмодзи Блика'}
              maxLength={300} value={layer.value}
              onChange={event => state.change({ ...state.editor,
                layers: state.editor.layers.map(x => x.id === layer.id ? { ...x, value: Array.from(event.target.value).slice(0, 150).join('') } : x) })} />
            <button onClick={() => state.change({ ...state.editor,
              layers: state.editor.layers.filter(x => x.id !== layer.id) })}>×</button>
            <select aria-label="Цвет слоя" value={layer.style ?? 'light'}
              onChange={event => state.change({ ...state.editor, layers: state.editor.layers.map(x =>
                x.id === layer.id ? { ...x, style: event.target.value as BlikLayer['style'] } : x) })}>
              <option value="light">Светлый</option>
              <option value="dark">Тёмный</option>
              <option value="accent">Акцент</option>
            </select>
            <input aria-label="Размер слоя" type="range" min="0.5" max="3" step="0.1"
              value={layer.scale} onChange={event => state.change({ ...state.editor,
                layers: state.editor.layers.map(x => x.id === layer.id ?
                  { ...x, scale: Number(event.target.value) } : x) })} />
            <input aria-label="Поворот слоя" type="range" min="-180" max="180" step="5"
              value={layer.rotation} onChange={event => state.change({ ...state.editor,
                layers: state.editor.layers.map(x => x.id === layer.id ?
                  { ...x, rotation: Number(event.target.value) } : x) })} />
          </div>)}
          <button disabled={busy} onClick={() => void goPreview()}>Предпросмотр</button>
        </> : <>
          <p>Так будет выглядеть твой Блик.</p>
          <button onClick={() => setPreview(false)}>Изменить</button>
          <button disabled={busy || !publishTransport} onClick={() => void publish()}>
            {busy ? 'Публикация…' : publishTransport ? 'Опубликовать' : 'Публикация пока недоступна'}
          </button>
        </>}
      </>}
    </section>
  );
}
