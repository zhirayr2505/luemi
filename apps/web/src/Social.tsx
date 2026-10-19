import { SlideSwap } from './motion/SlideDeck';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { alina, type DemoState, type Message, type Profile } from '../../../packages/core/domain';
import { Button, Empty, Icon, IconButton, Modal, Portrait, Tabs } from './ui';
import { preparePhoto, putMedia } from './storage';
const LIKES_ORDER = ['Мэтчи', 'Входящие'];
const CHAT_FILTER_ORDER = ['Все', 'Непрочитанные'];
type Props = {
  state: DemoState;
  setState: Dispatch<SetStateAction<DemoState>>;
  openChat: (id: string) => void;
  openProfile: (p: Profile) => void;
  notify: (s: string) => void;
};
export function Likes({ state, setState, openChat, openProfile, notify }: Props) {
  const [tab, setTab] = useState('Мэтчи'),
    [filter, setFilter] = useState('Обычные');
  const blocked = state.blocked.includes('alina'),
    matched = state.matches.includes('alina');
  return (
    <>
      <div className="page-title">
        <h1>Симпатии</h1>
        <p>Здесь начинается взаимность</p>
      </div>
      <Tabs items={['Мэтчи', 'Входящие']} value={tab} onChange={setTab} />
      <SlideSwap active={tab} order={LIKES_ORDER}>
        {tab === 'Мэтчи' ? (
          matched && !blocked ? (
            <>
              <div className="new-matches">
                <button onClick={() => openChat('alina')}>
                  <Portrait photo={alina.photos[0]} className="avatar" />
                  <span>Алина</span>
                </button>
                <div>
                  <strong>У вас взаимная симпатия</strong>
                  <p>Самое время сказать «Привет»</p>
                </div>
              </div>
              <button className="person-row glass" onClick={() => openChat('alina')}>
                <Portrait photo={alina.photos[0]} className="avatar" />
                <div>
                  <strong>
                    Алина, 26 <span className="tiny-heart">♡</span>
                  </strong>
                  <p>Кофе · Путешествия · Книги</p>
                  <span className="caption">Написать бесплатно</span>
                </div>
                <Icon name="next" />
              </button>
            </>
          ) : (
            <Empty title="Взаимность ещё впереди">
              <p>Поставь симпатию Алине в Ленте, чтобы проверить сценарий мэтча.</p>
            </Empty>
          )
        ) : (
          <>
            <div className="segmented compact">
              {['Обычные', 'Особенные', 'Обращения'].map((x) => (
                <button
                  className={filter === x ? 'active' : ''}
                  onClick={() => setFilter(x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </div>
            {filter === 'Обычные' && !blocked && !matched ? (
              <>
                <p className="caption">Доступно открытий сегодня: {3 - state.revealed.length}</p>
                <div className="incoming-card glass">
                  <div className={state.revealed.includes('alina') ? '' : 'blurred'}>
                    <Portrait photo={alina.photos[0]} />
                  </div>
                  <div className="incoming-copy">
                    <h2>Алина, 26</h2>
                    <p>Есть о чём поговорить: кофе и путешествия</p>
                    {state.revealed.includes('alina') ? (
                      <Button variant="primary" onClick={() => openProfile(alina)}>
                        Посмотреть профиль
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => {
                          if (state.revealed.length >= 3) {
                            notify('Бесплатные открытия на сегодня закончились.');
                            return;
                          }
                          setState((s) => ({ ...s, revealed: [...s.revealed, 'alina'] }));
                        }}
                      >
                        Открыть бесплатно
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <Empty
                title={
                  filter === 'Особенные'
                    ? 'Особенное ещё впереди'
                    : filter === 'Обращения'
                      ? 'Пока нет обращений'
                      : 'Все симпатии просмотрены'
                }
              >
                <p>
                  {filter === 'Обращения'
                    ? 'Здесь появятся первые обращения, которые можно принять или отклонить.'
                    : 'Когда кто-то проявит интерес, ты увидишь это здесь.'}
                </p>
              </Empty>
            )}
          </>
        )}
      </SlideSwap>
    </>
  );
}
export function Chats({ state, openChat }: Props) {
  const [tab, setTab] = useState('Все'),
    [search, setSearch] = useState('');
  const has =
    tab === 'Все' && !state.blocked.includes('alina') && 'алина'.includes(search.toLowerCase());
  const last = state.messages.filter((x) => x.chatId === 'alina').at(-1);
  return (
    <>
      <div className="page-title">
        <h1>Чаты</h1>
        <p>Ваш маленький мир, на двоих</p>
      </div>
      <label className="search-field">
        <Icon name="search" />
        <input
          aria-label="Поиск чатов"
          placeholder="Найти разговор"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <Tabs items={['Все', 'Непрочитанные']} value={tab} onChange={setTab} />
      <SlideSwap active={tab} order={CHAT_FILTER_ORDER}>
        {has ? (
          <button className="person-row chat-row" onClick={() => openChat('alina')}>
            <div className="avatar-wrap">
              <Portrait photo={alina.photos[0]} className="avatar" />
            </div>
            <div>
              <div className="chat-title">
                <strong>
                  Алина <span className="tiny-verified">✓</span>
                </strong>
                <small>{last?.time}</small>
              </div>
              <p>
                {last
                  ? (last.mine ? 'Ты: ' : '') + (last.image ? 'Фотография' : last.text)
                  : 'Начни разговор'}
              </p>
              <span className="caption">Демонстрационная переписка</span>
            </div>
          </button>
        ) : (
          <Empty kind="no-messages" title={search ? 'Разговор не найден' : 'Здесь спокойно'}>
            <p>
              {search ? 'Попробуй другое имя.' : 'Все сообщения прочитаны. Новые появятся здесь.'}
            </p>
          </Empty>
        )}
      </SlideSwap>
    </>
  );
}
export function Chat({
  state,
  setState,
  notify,
  openProfile,
}: {
  state: DemoState;
  setState: Dispatch<SetStateAction<DemoState>>;
  notify: (s: string) => void;
  openProfile: (p: Profile) => void;
}) {
  const text = state.drafts.alina || '';
  const [reply, setReply] = useState<Message | null>(null),
    [edit, setEdit] = useState<Message | null>(null),
    [menu, setMenu] = useState<Message | null>(null),
    [emojis, setEmojis] = useState(false),
    [busy, setBusy] = useState(false),
    [newBelow, setNewBelow] = useState(false);
  const history = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true),
    forceBottom = useRef(true),
    touch = useRef({ x: 0, y: 0 });
  const count = state.messages.length;
  useEffect(() => {
    const el = history.current;
    if (!el) return;
    if (forceBottom.current || nearBottom.current) {
      el.scrollTop = el.scrollHeight;
      forceBottom.current = false;
      setNewBelow(false);
    } else setNewBelow(true);
  }, [count]);
  function setText(value: string) {
    setState((s) => ({ ...s, drafts: { ...s.drafts, alina: value } }));
  }
  function send() {
    if (!text.trim() || busy) return;
    forceBottom.current = true;
    const now = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    if (edit)
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === edit.id ? { ...m, text: text.trim(), edited: true } : m,
        ),
        drafts: { ...s.drafts, alina: '' },
      }));
    else
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            id: crypto.randomUUID(),
            chatId: 'alina',
            text: text.trim(),
            mine: true,
            time: now,
            reply: reply?.text,
          },
        ],
        drafts: { ...s.drafts, alina: '' },
      }));
    setReply(null);
    setEdit(null);
    input.current?.focus();
  }
  async function attach(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        const image = await putMedia(await preparePhoto(f));
        forceBottom.current = true;
        setState((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              chatId: 'alina',
              text: '',
              image,
              mine: true,
              time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        }));
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Фото не добавлено.');
      }
    }
    setBusy(false);
    if (file.current) file.current.value = '';
  }
  const messages = state.messages.filter((x) => x.chatId === 'alina');
  return (
    <div className="chat-body">
      <button className="chat-partner glass" onClick={() => openProfile(alina)}>
        <Portrait photo={alina.photos[0]} className="avatar" />
        <div>
          <strong>
            Алина <span className="tiny-verified">✓</span>
          </strong>
          <span>Демо-разговор</span>
        </div>
        <Icon name="next" />
      </button>
      <div
        className="message-history"
        ref={history}
        onScroll={() => {
          const el = history.current!;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
          if (nearBottom.current) setNewBelow(false);
        }}
      >
        <div className="date-label">Ваш разговор</div>
        <div className="conversation-note">
          <Icon name="lock" size={14} /> Сообщения сохраняются только на этом устройстве
        </div>
        {messages.map((m) => (
          <div className={'message-row ' + (m.mine ? 'mine' : '')} key={m.id}>
            <div
              className="message"
              onDoubleClick={() =>
                setState((s) => ({
                  ...s,
                  messages: s.messages.map((x) =>
                    x.id === m.id ? { ...x, reaction: x.reaction ? '' : '💜' } : x,
                  ),
                }))
              }
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(m);
              }}
              onPointerDown={(e) => {
                touch.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerUp={(e) => {
                const dx = e.clientX - touch.current.x,
                  dy = e.clientY - touch.current.y;
                if (dx < -45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                  setReply(m);
                  setEdit(null);
                  input.current?.focus();
                }
              }}
            >
              {m.reply && (
                <blockquote>
                  <strong>{m.mine ? 'В ответ' : 'Ты'}</strong>
                  {m.reply}
                </blockquote>
              )}
              {m.image && (
                <Portrait photo={{ id: m.id, source: m.image }} className="message-photo" />
              )}
              {m.text && <p>{m.text}</p>}
              <div className="message-meta">
                {m.edited && 'изменено · '}
                {m.time}
                {m.mine && <span title="Сохранено локально"> ✓</span>}
                <button aria-label="Действия с сообщением" onClick={() => setMenu(m)}>
                  ···
                </button>
              </div>
              {m.reaction && (
                <button
                  className="reaction"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      messages: s.messages.map((x) => (x.id === m.id ? { ...x, reaction: '' } : x)),
                    }))
                  }
                >
                  {m.reaction} 1
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {newBelow && (
        <button
          className="new-messages"
          onClick={() => {
            history.current!.scrollTop = history.current!.scrollHeight;
          }}
        >
          К новым сообщениям ↓
        </button>
      )}
      <footer className="composer glass">
        {(reply || edit) && (
          <div className="reply-preview">
            <div>
              <strong>{edit ? 'Редактирование' : 'Ответ на сообщение'}</strong>
              <span>{(edit || reply)?.text || 'Фото'}</span>
            </div>
            <IconButton
              icon="close"
              label="Отменить ответ"
              onClick={() => {
                setReply(null);
                setEdit(null);
                if (edit) setText('');
              }}
            />
          </div>
        )}
        {emojis && (
          <div className="emoji-row">
            {['💜', '🥰', '✨', '😊', '😂', '😍', '👋', '☕'].map((x) => (
              <button key={x} onClick={() => setText(text + x)}>
                {x}
              </button>
            ))}
          </div>
        )}
        <div className="compose-row">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            ref={file}
            onChange={(e) => void attach(e.target.files)}
          />
          <IconButton
            icon="plus"
            label="Добавить фотографии"
            disabled={busy}
            onClick={() => file.current?.click()}
          />
          <div className="compose-field">
            <textarea
              ref={input}
              aria-label="Сообщение"
              placeholder={busy ? 'Подготовка фото…' : 'Сообщение'}
              rows={1}
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <IconButton icon="smile" label="Эмодзи" onClick={() => setEmojis(!emojis)} />
          </div>
          <IconButton
            className="gradient"
            icon={text.trim() ? 'send' : 'utility-microphone'}
            label={text.trim() ? 'Сохранить сообщение' : 'Голосовое сообщение'}
            onClick={() =>
              text.trim()
                ? send()
                : notify('Запись и доставка голосовых будут подключены вместе с сервером чатов.')
            }
            disabled={busy}
          />
        </div>
      </footer>
      {menu && (
        <Modal title="Сообщение" onClose={() => setMenu(null)}>
          <div className="emoji-row">
            {['💜', '🥰', '😂', '✨', '👍'].map((x) => (
              <button
                key={x}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    messages: s.messages.map((m) => (m.id === menu.id ? { ...m, reaction: x } : m)),
                  }));
                  setMenu(null);
                }}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="menu-list">
            <button
              onClick={() => {
                setReply(menu);
                setMenu(null);
                input.current?.focus();
              }}
            >
              Ответить
            </button>
            {menu.mine && !menu.image && (
              <button
                onClick={() => {
                  setEdit(menu);
                  setText(menu.text);
                  setMenu(null);
                }}
              >
                Редактировать
              </button>
            )}
            <button
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(menu.text)
                  .then(() => notify('Текст скопирован.'))
                  .catch(() => notify('Копирование недоступно в этом браузере.'));
                setMenu(null);
              }}
            >
              Копировать
            </button>
            <button
              className="danger"
              onClick={() => {
                setState((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== menu.id) }));
                setMenu(null);
                notify('Сообщение удалено из локального демо-разговора.');
              }}
            >
              Удалить локальное сообщение
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
