'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');

test('Vercel meneruskan seluruh API ke satu function', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok(config.rewrites.some((item) => item.source === '/api/:path*' && item.destination.includes('__path')));
  assert.ok(config.functions['api/index.js']);
  const handler = require('../api/index');
  assert.equal(typeof handler, 'function');
});



test('Vercel menerapkan header keamanan pada frontend dan API', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const globalHeaders = config.headers.find((item) => item.source === '/(.*)').headers;
  const names = new Set(globalHeaders.map((item) => item.key));
  for (const required of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options']) {
    assert.ok(names.has(required), `${required} harus tersedia`);
  }
});

test('rewrite Vercel mempertahankan endpoint API asli', async () => {
  const handler = require('../api/index');
  const headers = new Map();
  let body = '';
  const req = { method: 'GET', url: '/api?__path=health', headers: { host: 'example.test' }, socket: { remoteAddress: '127.0.0.1' } };
  const res = {
    statusCode: 0,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    end(value = '') { body += Buffer.isBuffer(value) ? value.toString('utf8') : String(value); }
  };
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(body).ok, true);
});

test('setup Supabase membuat tabel, rate limit, RLS, dan bucket private', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'setup.sql'), 'utf8');
  for (const table of ['app_state', 'admin_sessions', 'trusted_devices', 'audit_events', 'rate_limits']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(sql, /dapur-rini-public-media/);
  assert.match(sql, /dapur-rini-private-proofs/);
  assert.match(sql, /false, 1572864/);
});

test('backend serverless tidak memakai timer permanen atau filesystem upload production', () => {
  const server = fs.readFileSync(path.join(root, 'server', 'server.js'), 'utf8');
  assert.doesNotMatch(server, /setInterval\s*\(/);
  assert.doesNotMatch(server, /PUBLIC_UPLOAD_DIR/);
  assert.match(server, /db\.consumeRateLimit/);
  assert.match(server, /storage\.readPrivate/);
  assert.match(server, /storage\.readPublic/);
});

test('storage lokal mempertahankan validasi dan media publik dapat dibaca', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dapur-rini-storage-v4-'));
  const modulePath = require.resolve('../server/storage');
  const previous = process.env.DAPUR_RINI_PRIVATE_STORAGE_DIR;
  delete require.cache[modulePath];
  process.env.DAPUR_RINI_PRIVATE_STORAGE_DIR = temp;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  const storage = require('../server/storage');
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  try {
    const saved = await storage.savePublicImageDataUrl(dataUrl, 'qris');
    const file = await storage.readPublic(saved.key);
    assert.equal(file.mime, 'image/png');
    assert.ok(file.buffer.length > 0);
    assert.match(storage.publicMediaUrl(saved.key), /^\/api\/media\//);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
    delete require.cache[modulePath];
    if (previous === undefined) delete process.env.DAPUR_RINI_PRIVATE_STORAGE_DIR;
    else process.env.DAPUR_RINI_PRIVATE_STORAGE_DIR = previous;
  }
});


test('adapter Supabase Storage mengunggah, membaca, dan menghapus file private', async () => {
  const Module = require('module');
  const modulePath = require.resolve('../server/storage');
  const oldLoad = Module._load;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  const buckets = new Map();
  const fakeClient = {
    storage: {
      from(bucket) {
        if (!buckets.has(bucket)) buckets.set(bucket, new Map());
        const files = buckets.get(bucket);
        return {
          async upload(key, buffer) { files.set(key, Buffer.from(buffer)); return { data: { path: key }, error: null }; },
          async download(key) { const value = files.get(key); return value ? { data: new Blob([value]), error: null } : { data: null, error: { message: 'not found' } }; },
          async remove(keys) { keys.forEach((key) => files.delete(key)); return { data: [], error: null }; },
          async list() { return { data: [...files.keys()].map((name) => ({ name, id: name })), error: null }; }
        };
      }
    }
  };
  Module._load = function(request, parent, isMain) {
    if (request === '@supabase/supabase-js') return { createClient: () => fakeClient };
    return oldLoad.call(this, request, parent, isMain);
  };
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  delete require.cache[modulePath];
  const storage = require('../server/storage');
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  try {
    assert.equal(storage.DRIVER, 'supabase');
    const saved = await storage.saveImageDataUrl(dataUrl, 'proof');
    assert.ok(await storage.readPrivate(saved.key));
    assert.equal((await storage.healthCheck()).ok, true);
    await storage.removePrivate(saved.key);
    assert.equal(await storage.readPrivate(saved.key), null);
  } finally {
    Module._load = oldLoad;
    delete require.cache[modulePath];
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
