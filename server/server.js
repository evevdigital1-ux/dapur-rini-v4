'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const db = require('./database');
const domain = require('./domain');
const storage = require('./storage');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8080);
const ROOT = db.PUBLIC_ROOT || db.ROOT;
const MAX_BODY = 3 * 1024 * 1024;
const SESSION_TTL_MS = Number(process.env.DAPUR_RINI_SESSION_MINUTES || 30) * 60 * 1000;
const DEVICE_TTL_MS = Number(process.env.DAPUR_RINI_TRUSTED_DEVICE_DAYS || 30) * 24 * 60 * 60 * 1000;
const OPERATION_MODE = String(process.env.DAPUR_RINI_OPERATION_MODE || 'DEMO').toUpperCase();
const IS_PRODUCTION = OPERATION_MODE === 'PRODUCTION' || process.env.NODE_ENV === 'production';
const COOKIE_SECURE = process.env.DAPUR_RINI_COOKIE_SECURE === 'true' || IS_PRODUCTION;
const localRateLimits = new Map();
let initializePromise = null;
let lastMaintenanceAt = 0;
const startedAt = Date.now();
const adminPassword = process.env.DAPUR_RINI_ADMIN_PASSWORD || 'rini123';
const passwordSalt = process.env.DAPUR_RINI_PASSWORD_SALT || 'dapur-rini-local-v3';
const devicePin = String(process.env.DAPUR_RINI_DEVICE_PIN || '');
const passwordHash = crypto.scryptSync(adminPassword, passwordSalt, 64);
const devicePinHash = devicePin ? crypto.scryptSync(devicePin, `${passwordSalt}:device`, 64) : null;

if (!process.env.DAPUR_RINI_ADMIN_PASSWORD) console.warn('PERINGATAN: password admin bawaan masih aktif. Jangan gunakan untuk transaksi nyata.');
if (IS_PRODUCTION && db.DRIVER !== 'postgres') console.warn('PERINGATAN: mode produksi aktif tanpa PostgreSQL. Readiness akan gagal.');

async function ensureInitialized() {
  if (process.env.VERCEL && OPERATION_MODE === 'PRODUCTION' && db.DRIVER !== 'postgres') {
    throw Object.assign(new Error('DATABASE_URL Supabase wajib diatur pada deployment Vercel production.'), { statusCode: 503 });
  }
  if (process.env.VERCEL && OPERATION_MODE === 'PRODUCTION' && storage.DRIVER !== 'supabase') {
    throw Object.assign(new Error('SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diatur pada deployment Vercel production.'), { statusCode: 503 });
  }
  if (!initializePromise) initializePromise = Promise.all([db.initialize(), storage.initialize()]);
  return initializePromise;
}

async function runMaintenance() {
  const now = Date.now();
  if (now - lastMaintenanceAt < 60 * 1000) return;
  lastMaintenanceAt = now;
  await Promise.all([db.cleanupSessions(), db.cleanupRateLimits()]);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  if (IS_PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function json(res, status, payload, extraHeaders = {}) {
  securityHeaders(res);
  Object.entries(extraHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    if (index < 1) return ['', ''];
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }).filter(([key]) => key));
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `SameSite=${options.sameSite || 'Strict'}`];
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (COOKIE_SECURE) parts.push('Secure');
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return parts.join('; ');
}

function tokenHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

async function getSession(req, { touch = true } = {}) {
  const rawToken = parseCookies(req).dapur_rini_session;
  if (!rawToken) return null;
  const hash = tokenHash(rawToken);
  const session = await db.getSession(hash);
  if (!session || session.expiresAt <= Date.now()) {
    await db.deleteSession(hash).catch(() => undefined);
    return null;
  }
  if (touch) {
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    await db.touchSession(hash, session.expiresAt);
  }
  return { ...session, rawToken };
}

async function requireAdmin(req) {
  const session = await getSession(req);
  if (!session) throw Object.assign(new Error('Sesi admin tidak tersedia atau sudah berakhir.'), { statusCode: 401 });
  if (req.method !== 'GET' && req.headers['x-csrf-token'] !== session.csrf) throw Object.assign(new Error('Token keamanan tidak valid. Muat ulang halaman dan coba lagi.'), { statusCode: 403 });
  return session;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Data yang dikirim terlalu besar.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (_) {
        reject(Object.assign(new Error('Format data tidak valid.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function publicState(state) {
  const settings = { ...state.settings, operationMode: OPERATION_MODE };
  delete settings.adminUsername;
  delete settings.sessionTimeoutMinutes;
  return {
    version: state.version, generatedAt: state.generatedAt, updatedAt: state.updatedAt, stateRevision: state.stateRevision,
    settings, menus: state.menus, batches: state.batches, testimonials: state.testimonials
  };
}

function adminState(state) {
  const copy = domain.deepClone(state);
  copy.cart = [];
  copy.settings.operationMode = OPERATION_MODE;
  copy.runtime = { databaseDriver: db.DRIVER, storageDriver: storage.DRIVER, secureCookie: COOKIE_SECURE, operationMode: OPERATION_MODE };
  return copy;
}

function safeEqualSecret(value, expectedHash, salt) {
  const candidate = crypto.scryptSync(String(value || ''), salt, 64);
  return crypto.timingSafeEqual(candidate, expectedHash);
}

function safeEqualPassword(value) {
  return safeEqualSecret(value, passwordHash, passwordSalt);
}

function safeEqualDevicePin(value) {
  return Boolean(devicePinHash) && safeEqualSecret(value, devicePinHash, `${passwordSalt}:device`);
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

async function checkWindowLimit(scope, req, { max, windowMs, message }) {
  const key = tokenHash(`${scope}:${clientIp(req)}`);
  if (db.DRIVER === 'postgres') return db.consumeRateLimit(key, { max, windowMs, message });
  const now = Date.now();
  const record = localRateLimits.get(key) || { count: 0, resetAt: now + windowMs };
  if (record.resetAt <= now) Object.assign(record, { count: 0, resetAt: now + windowMs });
  if (record.count >= max) throw Object.assign(new Error(message), { statusCode: 429 });
  record.count += 1;
  localRateLimits.set(key, record);
  return record;
}

async function clearRateLimit(scope, req) {
  const key = tokenHash(`${scope}:${clientIp(req)}`);
  localRateLimits.delete(key);
  await db.clearRateLimit(key);
}

async function savePublicDataUrl(dataUrl, prefix) {
  if (!dataUrl) return '';
  const publicPrefix = prefix.startsWith('menu') ? 'menu' : prefix.startsWith('qris') ? 'qris' : 'testimonial';
  const saved = await storage.savePublicImageDataUrl(dataUrl, publicPrefix);
  return storage.publicMediaUrl(saved.key);
}

function normalizePhoneDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('62')) digits = `0${digits.slice(2)}`;
  return digits;
}

function findOrderByIdentity(state, code, phone) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const normalizedPhone = normalizePhoneDigits(phone);
  return state.orders.find((item) => item.code === normalizedCode && normalizePhoneDigits(item.phone) === normalizedPhone) || null;
}

async function executeCommand(command, payload, auth) {
  let imagePath = '';
  let previousPublicImage = '';
  try {
    if (['addTestimonial', 'updateTestimonial'].includes(command) && payload.imageData) imagePath = await savePublicDataUrl(payload.imageData, 'testimonial');
    if (['addMenu', 'updateMenu'].includes(command) && (payload.imageData || payload.patch?.imageData)) imagePath = await savePublicDataUrl(payload.imageData || payload.patch?.imageData, 'menu');
    if (command === 'updateSettings' && payload.qrisImageData) imagePath = await savePublicDataUrl(payload.qrisImageData, 'qris');
    const result = await db.transaction((state) => {
      state.settings.operationMode = OPERATION_MODE;
      state.settings.demoMode = OPERATION_MODE !== 'PRODUCTION';
      switch (command) {
        case 'createOrder': return domain.createOrder(state, payload);
        case 'reviewPayment': return domain.reviewPayment(state, payload.orderId, payload.decision, { ...payload, actor: auth?.username || 'admin' });
        case 'verifyOrder': return domain.verifyOrder(state, payload.orderId);
        case 'confirmRefund': return domain.confirmRefund(state, payload.orderId, { ...payload, actor: auth?.username || 'admin' });
        case 'rejectOrExpireOrder': return domain.rejectOrExpireOrder(state, payload.orderId, payload.type);
        case 'extendPaymentDeadline': return domain.extendPaymentDeadline(state, payload.orderId, payload.minutes);
        case 'updateOrderStatus': return domain.updateOrderStatus(state, payload.orderId, payload.status);
        case 'bulkProductionStatus': return domain.bulkProductionStatus(state, payload.status, payload.deliveryDate || '');
        case 'updateBatch': return domain.updateBatch(state, payload.batchId, payload.patch || {});
        case 'closeAllOpenBatches': return domain.closeAllOpenBatches(state);
        case 'updateMenu': {
          const menu = state.menus.find((item) => item.id === payload.menuId);
          if (menu) previousPublicImage = menu.image || '';
          const patch = { ...(payload.patch || {}), ...(imagePath ? { image: imagePath } : {}) };
          delete patch.imageData;
          return domain.updateMenu(state, payload.menuId, patch);
        }
        case 'addMenu': {
          const data = { ...payload, ...(imagePath ? { image: imagePath } : {}) };
          delete data.imageData;
          return domain.addMenu(state, data);
        }
        case 'deleteMenu': return domain.deleteMenu(state, payload.menuId);
        case 'addBatch': return domain.addBatch(state, payload);
        case 'updateSettings':
          previousPublicImage = state.settings.qrisImage || '';
          return domain.updateSettings(state, { ...(payload.patch || payload), ...(imagePath ? { qrisImage: imagePath } : {}) });
        case 'markNotificationRead': return domain.markNotificationRead(state, payload.notificationId);
        case 'markAllNotificationsRead': return domain.markAllNotificationsRead(state);
        case 'addTestimonial': {
          const data = { ...payload, ...(imagePath ? { image: imagePath } : {}) };
          delete data.imageData;
          return domain.addTestimonial(state, data);
        }
        case 'updateTestimonial': {
          const item = state.testimonials.find((entry) => entry.id === payload.testimonialId);
          if (item) previousPublicImage = item.image || '';
          const patch = { ...(payload.patch || payload), ...(imagePath ? { image: imagePath } : {}) };
          delete patch.imageData;
          return domain.updateTestimonial(state, payload.testimonialId, patch);
        }
        case 'deleteTestimonial': {
          const item = state.testimonials.find((entry) => entry.id === payload.testimonialId);
          if (item && item.image) previousPublicImage = item.image;
          return domain.deleteTestimonial(state, payload.testimonialId);
        }
        case 'processExpiredOrders': return domain.processExpiredOrders(state);
        default: throw Object.assign(new Error('Perintah tidak dikenal.'), { statusCode: 400 });
      }
    }, { action: command, actor: command === 'createOrder' ? 'customer' : auth?.username || 'admin', detail: `Perintah ${command} berhasil.` });
    if (imagePath && previousPublicImage && previousPublicImage !== imagePath) {
      const oldKey = storage.keyFromPublicMediaUrl(previousPublicImage);
      if (oldKey) await storage.removePublic(oldKey).catch(() => undefined);
    }
    return result;
  } catch (error) {
    if (imagePath) {
      const key = storage.keyFromPublicMediaUrl(imagePath);
      if (key) await storage.removePublic(key).catch(() => undefined);
    }
    throw error;
  }
}

async function readiness() {
  let databaseReachable = false;
  let privateStorageWritable = false;
  try { databaseReachable = Boolean((await db.healthCheck()).ok); } catch (_) {}
  try { privateStorageWritable = Boolean((await storage.healthCheck()).ok); } catch (_) {}
  let state = null;
  try { state = await db.read({ processExpiry: false }); } catch (_) {}
  const checks = {
    databaseReachable,
    privateStorageWritable,
    postgres: db.DRIVER === 'postgres',
    supabaseStorage: storage.DRIVER === 'supabase',
    productionMode: OPERATION_MODE === 'PRODUCTION',
    strongPasswordConfigured: Boolean(process.env.DAPUR_RINI_ADMIN_PASSWORD) && adminPassword.length >= 12,
    uniquePasswordSalt: Boolean(process.env.DAPUR_RINI_PASSWORD_SALT) && passwordSalt.length >= 16,
    devicePinConfigured: devicePin.length >= 6,
    secureCookie: COOKIE_SECURE,
    noDemoOrders: Boolean(state) && !state.orders.some((order) => order.isDemo),
    manualPaymentConfigured: Boolean(state) && (Boolean(String(state.settings.bankAccount || '').trim()) || Boolean(String(state.settings.qrisImage || '').trim()) || state.settings.cashPickupEnabled === true)
  };
  return { ready: Object.values(checks).every(Boolean), checks };
}

async function apiHandler(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const state = await db.read();
    return json(res, 200, { ok: true, service: 'dapur-rini', version: state.version, revision: state.stateRevision, database: db.DRIVER, mode: OPERATION_MODE, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), time: new Date().toISOString() });
  }
  if (req.method === 'GET' && url.pathname === '/api/readiness') {
    const result = await readiness();
    return json(res, result.ready ? 200 : 503, { ok: result.ready, ...result });
  }
  if (req.method === 'GET' && url.pathname === '/api/session') {
    const session = await getSession(req);
    return json(res, 200, { authenticated: Boolean(session), csrfToken: session?.csrf || null, expiresAt: session?.expiresAt || null });
  }
  if (req.method === 'GET' && url.pathname === '/api/state') {
    const state = await db.read();
    const session = await getSession(req);
    return json(res, 200, { ok: true, authenticated: Boolean(session), state: session ? adminState(state) : publicState(state) });
  }
  if (req.method === 'POST' && url.pathname === '/api/login') {
    await checkWindowLimit('login', req, { max: 5, windowMs: 5 * 60 * 1000, message: 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit.' });
    const body = await readBody(req);
    const state = await db.read({ processExpiry: false });
    const username = String(state.settings.adminUsername || 'admin');
    const usernameOk = String(body.username || '') === username;
    if (!usernameOk || !safeEqualPassword(body.password)) {
      await db.appendAudit({ action: 'LOGIN_FAILED', actor: clientIp(req), detail: 'Kredensial admin ditolak.' });
      return json(res, 401, { ok: false, error: 'Username atau password salah.' });
    }

    const cookies = parseCookies(req);
    const existingDeviceRaw = cookies.dapur_rini_device || '';
    const existingDeviceHash = existingDeviceRaw ? tokenHash(existingDeviceRaw) : '';
    const trusted = await db.isTrustedDevice(existingDeviceHash, username);
    if (devicePinHash && !trusted && !safeEqualDevicePin(body.devicePin)) {
      await db.appendAudit({ action: 'DEVICE_VERIFICATION_FAILED', actor: username, detail: 'Kode perangkat baru tidak valid.' });
      return json(res, 403, { ok: false, code: 'DEVICE_PIN_REQUIRED', error: 'Masukkan kode perangkat untuk HP ini.' });
    }

    await clearRateLimit('login', req);
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const csrf = crypto.randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    let deviceRaw = existingDeviceRaw;
    if (!trusted) {
      deviceRaw = crypto.randomBytes(32).toString('base64url');
      await db.trustDevice({ deviceHash: tokenHash(deviceRaw), username, expiresAt: Date.now() + DEVICE_TTL_MS });
    }
    await db.createSession({ tokenHash: tokenHash(rawToken), csrf, expiresAt, username, deviceHash: tokenHash(deviceRaw) });
    await db.appendAudit({ action: 'LOGIN_SUCCESS', actor: username, detail: trusted ? 'Sesi admin dibuat dari perangkat tepercaya.' : 'Sesi admin dibuat dan perangkat ditandai tepercaya.' });
    return json(res, 200, { ok: true, csrfToken: csrf, expiresAt }, {
      'Set-Cookie': [cookie('dapur_rini_session', rawToken, { maxAge: Math.floor(SESSION_TTL_MS / 1000) }), cookie('dapur_rini_device', deviceRaw, { maxAge: Math.floor(DEVICE_TTL_MS / 1000) })]
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const session = await requireAdmin(req);
    await db.deleteSession(session.tokenHash);
    await db.appendAudit({ action: 'LOGOUT', actor: session.username, detail: 'Sesi admin dihapus.' });
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('dapur_rini_session', '', { maxAge: 0 }) });
  }
  if (req.method === 'POST' && url.pathname === '/api/reset') {
    const session = await requireAdmin(req);
    if (IS_PRODUCTION) return json(res, 403, { ok: false, error: 'Reset data dinonaktifkan pada mode produksi.' });
    const result = await db.reset(session.username);
    return json(res, 200, { ok: true, result: result.result, state: adminState(result.state) });
  }
  if (req.method === 'POST' && url.pathname === '/api/command') {
    const body = await readBody(req);
    const customer = body.command === 'createOrder';
    if (customer) await checkWindowLimit('checkout', req, { max: 12, windowMs: 5 * 60 * 1000, message: 'Terlalu banyak percobaan pesanan. Coba lagi beberapa menit.' });
    const session = customer ? null : await requireAdmin(req);
    const result = await executeCommand(body.command, body.payload || {}, session);
    const visible = customer ? publicState(result.state) : adminState(result.state);
    const safeResult = body.command === 'createOrder'
      ? { id: result.result.id, code: result.result.code, trackingToken: result.result.trackingToken, customerName: result.result.customerName, phone: result.result.phone, total: result.result.total, paymentMethod: result.result.paymentMethod, paymentStatus: result.result.paymentStatus, orderStatus: result.result.orderStatus, paymentDeadline: result.result.paymentDeadline, deliveryAt: result.result.deliveryAt, fulfillment: result.result.fulfillment }
      : result.result;
    return json(res, 200, { ok: true, result: safeResult, state: visible });
  }
  if (req.method === 'POST' && url.pathname === '/api/payment-proof') {
    await checkWindowLimit('payment-proof', req, { max: 10, windowMs: 5 * 60 * 1000, message: 'Terlalu banyak unggahan. Coba lagi beberapa menit.' });
    const body = await readBody(req);
    const state = await db.read({ processExpiry: false });
    const order = findOrderByIdentity(state, body.code, body.phone);
    if (!order) return json(res, 404, { ok: false, error: 'Pesanan tidak ditemukan.' });
    let saved;
    try {
      saved = await storage.saveImageDataUrl(body.proofData, 'proof');
      const result = await db.transaction((draft) => {
        const current = findOrderByIdentity(draft, body.code, body.phone);
        if (!current) throw new Error('Pesanan tidak ditemukan.');
        return domain.submitPaymentProof(draft, current.id, {
          proofKey: saved.key, proofMime: saved.mime, proofName: body.proofName,
          senderName: body.senderName, reportedAmount: body.reportedAmount, paidAt: body.paidAt
        });
      }, { action: 'submitPaymentProof', actor: 'customer', detail: `Bukti pembayaran ${order.code} diunggah.` });
      if (order.proofKey && order.proofKey !== saved.key) await storage.removePrivate(order.proofKey).catch(() => undefined);
      const safe = { code: result.result.code, paymentStatus: result.result.paymentStatus, orderStatus: result.result.orderStatus, reviewReason: result.result.reviewReason || '' };
      return json(res, 200, { ok: true, order: safe });
    } catch (error) {
      if (saved?.key) await storage.removePrivate(saved.key).catch(() => undefined);
      throw error;
    }
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/proofs/')) {
    await requireAdmin(req);
    const key = decodeURIComponent(url.pathname.slice('/api/proofs/'.length));
    const file = await storage.readPrivate(key);
    if (!file) return json(res, 404, { ok: false, error: 'Bukti pembayaran tidak ditemukan.' });
    securityHeaders(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', file.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    return res.end(file.buffer);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/media/')) {
    const key = decodeURIComponent(url.pathname.slice('/api/media/'.length));
    const file = await storage.readPublic(key);
    if (!file) return json(res, 404, { ok: false, error: 'Media tidak ditemukan.' });
    securityHeaders(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', file.mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    return res.end(file.buffer);
  }
  if (req.method === 'GET' && url.pathname === '/api/track') {
    await checkWindowLimit('track', req, { max: 30, windowMs: 5 * 60 * 1000, message: 'Terlalu banyak pencarian pesanan. Coba lagi beberapa menit.' });
    const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
    const phone = normalizePhoneDigits(url.searchParams.get('phone') || '');
    if (!/^DR-\d{6}-\d{4}$/.test(code) || phone.length < 9) return json(res, 400, { ok: false, error: 'Nomor pesanan atau telepon tidak valid.' });
    const state = await db.read();
    const order = findOrderByIdentity(state, code, phone);
    if (!order) return json(res, 404, { ok: false, error: 'Pesanan tidak ditemukan untuk kombinasi tersebut.' });
    const safe = {
      code: order.code, customerName: order.customerName.split(' ')[0], fulfillment: order.fulfillment,
      paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus,
      reviewReason: order.reviewReason || '', proofUploadedAt: order.proofUploadedAt || null,
      createdAt: order.createdAt, deliveryAt: order.deliveryAt, paymentDeadline: order.paymentDeadline,
      total: order.total, items: order.items.map(({ name, qty, unit }) => ({ name, qty, unit }))
    };
    return json(res, 200, { ok: true, order: safe });
  }
  if (req.method === 'GET' && url.pathname === '/api/metrics') {
    await requireAdmin(req);
    const state = await db.read();
    return json(res, 200, { ok: true, metrics: { revision: state.stateRevision, orders: state.orders.length, paidOrders: state.orders.filter((o) => o.paymentStatus === 'PAID').length, paymentsToCheck: state.orders.filter((o) => ['PENDING_REVIEW', 'LATE_PAYMENT_REVIEW'].includes(o.paymentStatus)).length, activeBatches: state.batches.filter((b) => ['WAITING_OPENER', 'OPEN', 'CLOSING_SOON', 'OPENER_PENDING_PAYMENT'].includes(b.status)).length } });
  }
  return json(res, 404, { ok: false, error: 'Halaman atau layanan tidak ditemukan.' });
}

function staticHandler(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch (_) { return json(res, 400, { ok: false, error: 'Alamat file tidak valid.' }); }
  if (pathname === '/') pathname = '/index.html';

  const isIndex = pathname === '/index.html';
  const isAsset = pathname.startsWith('/assets/');
  if (!isIndex && !isAsset) return json(res, 404, { ok: false, error: 'File tidak ditemukan.' });

  const base = isIndex ? ROOT : path.join(ROOT, 'assets');
  const relative = isIndex ? 'index.html' : pathname.slice('/assets/'.length);
  const target = path.resolve(base, relative);
  if (!target.startsWith(`${base}${path.sep}`) && target !== base) return json(res, 403, { ok: false, error: 'Alamat file ditolak.' });
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return json(res, 404, { ok: false, error: 'File tidak ditemukan.' });

  securityHeaders(res);
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(target).toLowerCase()] || 'application/octet-stream');
  if (/\.(?:webp|png|jpg|jpeg|css|js)$/.test(target)) res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(target).pipe(res);
}

async function requestHandler(req, res, { serveStatic = false } = {}) {
  try {
    await ensureInitialized();
    await runMaintenance();
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith('/api/')) return await apiHandler(req, res, url);
    if (serveStatic) return staticHandler(req, res, url);
    return json(res, 404, { ok: false, error: 'File tidak ditemukan.' });
  } catch (error) {
    console.error(error);
    return json(res, error.statusCode || 400, { ok: false, error: error.message || 'Terjadi kesalahan server.' });
  }
}

async function start() {
  await ensureInitialized();
  const server = http.createServer((req, res) => requestHandler(req, res, { serveStatic: true }));
  server.listen(PORT, HOST, () => console.log(`Dapur Rini v4.0 berjalan di http://${HOST}:${PORT} (${db.DRIVER}, ${storage.DRIVER}, ${OPERATION_MODE})`));
  const shutdown = () => server.close(async () => { await db.close(); process.exit(0); });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Server gagal dimulai:', error);
    process.exit(1);
  });
}

module.exports = { requestHandler, apiHandler, start, readiness, ensureInitialized };
