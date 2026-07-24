'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORAGE_DIR = process.env.DAPUR_RINI_PRIVATE_STORAGE_DIR
  ? path.resolve(process.env.DAPUR_RINI_PRIVATE_STORAGE_DIR)
  : path.join(__dirname, 'private-storage');
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PUBLIC_BUCKET = String(process.env.SUPABASE_PUBLIC_MEDIA_BUCKET || 'dapur-rini-public-media').trim();
const PRIVATE_BUCKET = String(process.env.SUPABASE_PRIVATE_PROOF_BUCKET || 'dapur-rini-private-proofs').trim();
const DRIVER = SUPABASE_URL && SUPABASE_SECRET_KEY ? 'supabase' : 'file';
let supabaseClient = null;

function getClient() {
  if (DRIVER !== 'supabase') return null;
  if (supabaseClient) return supabaseClient;
  let createClient;
  try { ({ createClient } = require('@supabase/supabase-js')); }
  catch (_) { throw new Error('Paket @supabase/supabase-js belum terpasang. Jalankan npm install.'); }
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return supabaseClient;
}

function localDir(kind) {
  return path.join(STORAGE_DIR, kind === 'public' ? 'public-media' : 'private-proofs');
}

async function initialize() {
  if (DRIVER === 'file') {
    fs.mkdirSync(localDir('public'), { recursive: true, mode: 0o700 });
    fs.mkdirSync(localDir('private'), { recursive: true, mode: 0o700 });
  }
}

function detectImage(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { ext: '.png', mime: 'image/png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  return null;
}

function parseImageDataUrl(dataUrl) {
  const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(String(dataUrl || ''));
  if (!match) throw Object.assign(new Error('File harus berupa PNG, JPEG, atau WebP.'), { statusCode: 400 });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('Ukuran file maksimal 1,5 MB.'), { statusCode: 413 });
  const detected = detectImage(buffer);
  if (!detected) throw Object.assign(new Error('Isi file gambar tidak valid.'), { statusCode: 400 });
  return { buffer, ...detected };
}

function safeKey(key) {
  const value = String(key || '');
  if (!/^[a-z0-9/_-]+\.(?:png|jpg|webp)$/i.test(value) || value.includes('..') || value.startsWith('/')) return '';
  return value;
}

async function upload(kind, dataUrl, prefix = 'image') {
  await initialize();
  const parsed = parseImageDataUrl(dataUrl);
  const key = `${prefix}-${new Date().toISOString().slice(0, 10)}-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${parsed.ext}`;
  if (DRIVER === 'supabase') {
    const bucket = kind === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET;
    const { error } = await getClient().storage.from(bucket).upload(key, parsed.buffer, {
      contentType: parsed.mime,
      cacheControl: kind === 'public' ? '3600' : '0',
      upsert: false
    });
    if (error) throw Object.assign(new Error(`Gagal menyimpan file: ${error.message}`), { statusCode: 502 });
  } else {
    const target = path.join(localDir(kind), key);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, parsed.buffer, { mode: 0o600, flag: 'wx' });
  }
  return { key, mime: parsed.mime, size: parsed.buffer.length };
}

function saveImageDataUrl(dataUrl, prefix = 'proof') {
  return upload('private', dataUrl, prefix);
}

function savePublicImageDataUrl(dataUrl, prefix = 'media') {
  return upload('public', dataUrl, prefix);
}

async function read(kind, key) {
  const safe = safeKey(key);
  if (!safe) return null;
  if (DRIVER === 'supabase') {
    const bucket = kind === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET;
    const { data, error } = await getClient().storage.from(bucket).download(safe);
    if (error || !data) return null;
    const buffer = Buffer.from(await data.arrayBuffer());
    const detected = detectImage(buffer);
    if (!detected) return null;
    return { buffer, mime: detected.mime, size: buffer.length, key: safe };
  }
  const base = localDir(kind);
  const target = path.resolve(base, safe);
  if (!target.startsWith(`${base}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  const buffer = fs.readFileSync(target);
  const detected = detectImage(buffer);
  if (!detected) return null;
  return { buffer, mime: detected.mime, size: buffer.length, key: safe };
}

async function remove(kind, key) {
  const safe = safeKey(key);
  if (!safe) return;
  if (DRIVER === 'supabase') {
    const bucket = kind === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET;
    const { error } = await getClient().storage.from(bucket).remove([safe]);
    if (error && !/not found/i.test(error.message || '')) throw new Error(`Gagal menghapus file: ${error.message}`);
    return;
  }
  const base = localDir(kind);
  const target = path.resolve(base, safe);
  if (target.startsWith(`${base}${path.sep}`)) fs.rmSync(target, { force: true });
}

async function healthCheck() {
  await initialize();
  if (DRIVER === 'supabase') {
    const client = getClient();
    const [{ error: publicError }, { error: privateError }] = await Promise.all([
      client.storage.from(PUBLIC_BUCKET).list('', { limit: 1 }),
      client.storage.from(PRIVATE_BUCKET).list('', { limit: 1 })
    ]);
    if (publicError || privateError) throw new Error(publicError?.message || privateError?.message || 'Supabase Storage tidak dapat diakses.');
    return { ok: true, driver: DRIVER, buckets: [PUBLIC_BUCKET, PRIVATE_BUCKET] };
  }
  for (const kind of ['public', 'private']) {
    const dir = localDir(kind);
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    const probe = path.join(dir, `.health-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, 'ok', { mode: 0o600, flag: 'wx' });
    fs.rmSync(probe, { force: true });
  }
  return { ok: true, driver: DRIVER, directory: STORAGE_DIR };
}

function publicMediaUrl(key) {
  const safe = safeKey(key);
  return safe ? `/api/media/${encodeURIComponent(safe)}` : '';
}

function keyFromPublicMediaUrl(value) {
  const prefix = '/api/media/';
  const text = String(value || '');
  if (!text.startsWith(prefix)) return '';
  try { return safeKey(decodeURIComponent(text.slice(prefix.length))); }
  catch (_) { return ''; }
}

module.exports = {
  DRIVER, STORAGE_DIR, MAX_IMAGE_BYTES, PUBLIC_BUCKET, PRIVATE_BUCKET,
  initialize, detectImage, parseImageDataUrl, saveImageDataUrl, savePublicImageDataUrl,
  readPublic: (key) => read('public', key), readPrivate: (key) => read('private', key),
  removePublic: (key) => remove('public', key), removePrivate: (key) => remove('private', key),
  publicMediaUrl, keyFromPublicMediaUrl, healthCheck
};
