import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBlikiEditor } from '../src/bliki/bliki-editor-validation.js';

const editor = {
  fit: 'contain', scale: 1.5, translateX: 0, translateY: 0,
  muted: true, trimStartMs: 0, trimEndMs: 15000,
  layers: [{ id: '3fc4abcc-5c58-4bd4-bb92-6a1e6dd5709c',
    type: 'text', value: 'Привет 💜', x: 0.5, y: 0.25,
    scale: 1.2, rotation: 0, style: 'accent' }],
};
test('typed Bliki editor accepts only UI-supported safe fields', () => {
  assert.deepEqual(parseBlikiEditor(editor), editor);
  assert.equal(parseBlikiEditor({ ...editor, dangerous: '<script>' }), null);
  assert.equal(parseBlikiEditor({ ...editor, scale: Infinity }), null);
  assert.equal(parseBlikiEditor({ ...editor, layers: [{ ...editor.layers[0], x: 900 }] }), null);
  assert.equal(parseBlikiEditor({ ...editor, layers: [{ ...editor.layers[0], value: 'a'.repeat(151) }] }), null);
});
test('rejects prototype and duplicate text overlays, invalid trims', () => {
  assert.equal(parseBlikiEditor(Object.assign(Object.create(null), editor)), null);
  assert.equal(parseBlikiEditor({ ...editor, layers: [editor.layers[0], editor.layers[0]] }), null);
  assert.equal(parseBlikiEditor({ ...editor, trimStartMs: 15000, trimEndMs: 15000 }), null);
  assert.equal(parseBlikiEditor({ ...editor, layers: [null] }), null);
});
