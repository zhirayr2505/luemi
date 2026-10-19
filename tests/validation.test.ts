import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  adult,
  birthDate,
  validInterestCount,
  validName,
  validPhotoCount,
} from '../apps/web/src/validation';

test('имя допускает дефис и апостроф', () => {
  assert.equal(validName('Анна-Мария'), true);
  assert.equal(validName("O'Neil"), true);
  assert.equal(validName('1Admin'), false);
});
test('неправильные даты не нормализуются', () => {
  assert.equal(birthDate('31.02.2000'), null);
  assert.equal(adult('01.01.2015', new Date('2026-10-18T12:00:00Z')), false);
  assert.equal(adult('18.10.2008', new Date('2026-10-18T12:00:00Z')), true);
});
test('лимиты регистрации', () => {
  assert.equal(validPhotoCount(2), false);
  assert.equal(validPhotoCount(3), true);
  assert.equal(validPhotoCount(7), false);
  assert.equal(validInterestCount(15), true);
  assert.equal(validInterestCount(16), false);
});
