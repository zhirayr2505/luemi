import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState, type DemoState } from '../packages/core/domain';
import { ProfilePage } from '../apps/web/src/Profile';

const setState = (_next: React.SetStateAction<DemoState>) => {};
const openProfile = () => {};
const onRegister = () => {};
const notify = (_message: string) => {};

test('five-tab profile entry remains accessible before completing registration', () => {
  const empty = initialState();
  const html = renderToStaticMarkup(
    createElement(ProfilePage, {
      state: empty,
      setState,
      openProfile,
      onRegister,
      notify,
    }),
  );
  assert.match(html, /Посмотреть разделы профиля/);
  assert.match(html, /О себе · Блики · Фото · Аккаунт · Подарки/);
});
test('registered user keeps explicit link to five-tab profile', () => {
  const state = initialState();
  state.profile.name = 'Тест';
  const html = renderToStaticMarkup(
    createElement(ProfilePage, { state, setState, openProfile, onRegister, notify }),
  );
  assert.match(html, /Открыть профиль и разделы/);
  assert.match(html, /О себе · Блики · Фото · Аккаунт · Подарки/);
});
