'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

test('frontend tidak memakai inline event handler', () => {
  const html = read('public/index.html');
  const app = read('public/assets/app.js');
  assert.doesNotMatch(html, /\son\w+\s*=/i);
  assert.doesNotMatch(app, /<[^>]+\son\w+\s*=/i);
});

test('root aplikasi bukan live region global', () => {
  const html = read('public/index.html');
  assert.match(html, /<div id="app"><\/div>/);
  assert.doesNotMatch(html, /id="app"[^>]+aria-live/);
});

test('state bisnis tidak disimpan pada localStorage frontend', () => {
  const store = read('public/assets/store.js');
  assert.doesNotMatch(store, /dapurRiniDemoState/i);
  assert.match(store, /\/api\/state/);
});
