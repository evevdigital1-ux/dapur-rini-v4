'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const domain = require('./domain');

const os = require('os');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const DATA_DIR = process.env.DAPUR_RINI_DATA_DIR ? path.resolve(process.env.DAPUR_RINI_DATA_DIR) : (process.env.VERCEL ? path.join(os.tmpdir(), 'dapur-rini-data') : path.join(__dirname, 'data'));
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');
const TRUSTED_DEVICE_FILE = path.join(DATA_DIR, 'trusted-devices.json');
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const DRIVER = DATABASE_URL ? 'postgres' : 'file';
const OPERATION_MODE = String(process.env.DAPUR_RINI_OPERATION_MODE || 'DEMO').toUpperCase();
let pool = null;
let fileQueue = Promise.resolve();

function createSeed(now = new Date()) {
  const source = fs.readFileSync(path.join(PUBLIC_ROOT, 'assets', 'data.js'), 'utf8');
  const sandbox = { window: {}, console, Date, Intl, JSON, Math, Set };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'public/assets/data.js' });
  return sandbox.window.DAPUR_RINI_CREATE_SEED(now);
}

function createRuntimeSeed(now = new Date(), mode = OPERATION_MODE) {
  const state = createSeed(now);
  if (String(mode).toUpperCase() !== 'PRODUCTION') return state;
  state.settings.operationMode = 'PRODUCTION';
  state.settings.demoMode = false;
  state.settings.bankAccount = '';
  state.settings.qrisImage = '';
  state.settings.email = '';
  state.orders = [];
  state.notifications = [];
  state.activityLogs = [{ id: crypto.randomUUID(), action: 'INITIALIZE_PRODUCTION', detail: 'Data produksi kosong dibuat.', at: now.toISOString(), actor: 'system' }];
  state.batches = state.batches.map((batch) => ({
    ...batch, status: 'DRAFT', soldQty: 0, heldQty: 0, openerOrderId: null, closedByAdmin: false, isDemo: false
  }));
  state.menus = state.menus.map((menu) => ({ ...menu, isDemo: false }));
  state.testimonials = [];
  state.orderSequences = {};
  state.nextOrderSequence = 1;
  state.stateRevision = 1;
  return state;
}

function atomicWriteJson(filepath, value) {
  const temp = `${filepath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, filepath);
}

function initializeFile() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) atomicWriteJson(STATE_FILE, createRuntimeSeed(new Date()));
    if (!fs.existsSync(AUDIT_FILE)) fs.writeFileSync(AUDIT_FILE, '', { encoding: 'utf8', mode: 0o600 });
    if (!fs.existsSync(SESSION_FILE)) atomicWriteJson(SESSION_FILE, []);
    if (!fs.existsSync(TRUSTED_DEVICE_FILE)) atomicWriteJson(TRUSTED_DEVICE_FILE, []);
  } catch (err) {
    console.warn('File initialization warning:', err.message);
  }
}

function readJsonFile(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); }
  catch (_) { return fallback; }
}

function readStateSync() {
  initializeFile();
  try {
    return domain.ensureCollections(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch (error) {
    const corrupt = `${STATE_FILE}.corrupt-${Date.now()}`;
    if (fs.existsSync(STATE_FILE)) fs.renameSync(STATE_FILE, corrupt);
    const state = createRuntimeSeed(new Date());
    atomicWriteJson(STATE_FILE, state);
    appendAuditFile({ action: 'RECOVER_CORRUPT_STATE', actor: 'system', detail: `State rusak dipindahkan ke ${path.basename(corrupt)}.` });
    return state;
  }
}

function appendAuditFile(entry) {
  initializeFile();
  const line = JSON.stringify({ id: crypto.randomUUID(), at: new Date().toISOString(), ...entry });
  fs.appendFileSync(AUDIT_FILE, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function getPool() {
  if (pool) return pool;
  let Pool;
  try { ({ Pool } = require('pg')); }
  catch (_) {
    throw new Error('Driver PostgreSQL belum terpasang. Jalankan npm install sebelum memakai DATABASE_URL.');
  }
  pool = new Pool({
    connectionString: DATABASE_URL,
    max: Number(process.env.DAPUR_RINI_DB_POOL_SIZE || (process.env.VERCEL ? 1 : 5)),
    idleTimeoutMillis: Number(process.env.DAPUR_RINI_DB_IDLE_TIMEOUT_MS || 5000),
    connectionTimeoutMillis: Number(process.env.DAPUR_RINI_DB_CONNECT_TIMEOUT_MS || 10000),
    allowExitOnIdle: true,
    keepAlive: true,
    ssl: process.env.DAPUR_RINI_DB_SSL === 'disable' ? false : process.env.DAPUR_RINI_DB_SSL === 'require' ? { rejectUnauthorized: false } : undefined
  });
  pool.on('error', (error) => console.error('PostgreSQL pool error:', error));
  return pool;
}

async function initializePostgres() {
  const pg = await getPool();
  try {
    const existing = await pg.query('SELECT 1 FROM app_state WHERE id = 1');
    if (!existing.rowCount) {
      const seed = createRuntimeSeed(new Date());
      await pg.query('INSERT INTO app_state (id, payload, revision, updated_at) VALUES (1, $1::jsonb, $2, NOW())', [JSON.stringify(seed), Number(seed.stateRevision || 1)]);
      await pg.query('INSERT INTO audit_events (action, actor, detail, revision) VALUES ($1, $2, $3, $4)', ['INITIALIZE_STATE', 'system', 'State awal produksi dibuat.', Number(seed.stateRevision || 1)]);
    }
  } catch (error) {
    if (error.code === '42P01') {
      throw new Error('Tabel Supabase belum tersedia. Jalankan supabase/setup.sql melalui SQL Editor terlebih dahulu.');
    }
    throw error;
  }
}

async function initialize() {
  if (DRIVER === 'postgres') return initializePostgres();
  initializeFile();
}

function fileTransaction(mutator, audit = {}) {
  const execute = async () => {
    const state = readStateSync();
    domain.processExpiredOrders(state);
    const beforeRevision = Number(state.stateRevision || 0);
    const result = await mutator(state);
    domain.assertInvariants(state);
    state.stateRevision = beforeRevision + 1;
    state.updatedAt = new Date().toISOString();
    atomicWriteJson(STATE_FILE, state);
    appendAuditFile({ action: audit.action || 'STATE_TRANSACTION', actor: audit.actor || 'system', detail: audit.detail || '', revision: state.stateRevision });
    return { state: domain.deepClone(state), result: domain.deepClone(result ?? null) };
  };
  const pending = fileQueue.then(execute, execute);
  fileQueue = pending.catch(() => undefined);
  return pending;
}

async function postgresTransaction(mutator, audit = {}) {
  const pg = await getPool();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const client = await pg.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const row = await client.query('SELECT payload, revision FROM app_state WHERE id = 1 FOR UPDATE');
      if (!row.rowCount) throw new Error('State aplikasi belum diinisialisasi.');
      const state = domain.ensureCollections(row.rows[0].payload);
      domain.processExpiredOrders(state);
      const result = await mutator(state);
      domain.assertInvariants(state);
      state.stateRevision = Number(row.rows[0].revision || state.stateRevision || 0) + 1;
      state.updatedAt = new Date().toISOString();
      await client.query('UPDATE app_state SET payload = $1::jsonb, revision = $2, updated_at = NOW() WHERE id = 1', [JSON.stringify(state), state.stateRevision]);
      await client.query('INSERT INTO audit_events (action, actor, detail, revision) VALUES ($1, $2, $3, $4)', [audit.action || 'STATE_TRANSACTION', audit.actor || 'system', audit.detail || '', state.stateRevision]);
      await client.query('COMMIT');
      return { state: domain.deepClone(state), result: domain.deepClone(result ?? null) };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (['40001', '40P01'].includes(error.code) && attempt < 3) continue;
      throw error;
    } finally {
      client.release();
    }
  }
  throw new Error('Transaksi database gagal setelah tiga percobaan.');
}

function transaction(mutator, audit = {}) {
  return DRIVER === 'postgres' ? postgresTransaction(mutator, audit) : fileTransaction(mutator, audit);
}

async function readFile({ processExpiry = true } = {}) {
  if (!processExpiry) return domain.deepClone(readStateSync());
  const execute = async () => {
    const state = readStateSync();
    const before = JSON.stringify({ orders: state.orders, batches: state.batches, notifications: state.notifications });
    const count = domain.processExpiredOrders(state);
    const after = JSON.stringify({ orders: state.orders, batches: state.batches, notifications: state.notifications });
    if (before !== after) {
      state.stateRevision = Number(state.stateRevision || 0) + 1;
      state.updatedAt = new Date().toISOString();
      domain.assertInvariants(state);
      atomicWriteJson(STATE_FILE, state);
      appendAuditFile({ action: 'PROCESS_EXPIRY', actor: 'system', detail: `${count} pesanan kedaluwarsa diproses.`, revision: state.stateRevision });
    }
    return domain.deepClone(state);
  };
  const pending = fileQueue.then(execute, execute);
  fileQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

async function readPostgres({ processExpiry = true } = {}) {
  const pg = await getPool();
  if (!processExpiry) {
    const row = await pg.query('SELECT payload FROM app_state WHERE id = 1');
    if (!row.rowCount) throw new Error('State aplikasi belum tersedia.');
    return domain.deepClone(domain.ensureCollections(row.rows[0].payload));
  }
  const client = await pg.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const row = await client.query('SELECT payload, revision FROM app_state WHERE id = 1 FOR UPDATE');
    if (!row.rowCount) throw new Error('State aplikasi belum tersedia.');
    const state = domain.ensureCollections(row.rows[0].payload);
    const before = JSON.stringify({ orders: state.orders, batches: state.batches, notifications: state.notifications });
    const count = domain.processExpiredOrders(state);
    const after = JSON.stringify({ orders: state.orders, batches: state.batches, notifications: state.notifications });
    if (before !== after) {
      state.stateRevision = Number(row.rows[0].revision || state.stateRevision || 0) + 1;
      state.updatedAt = new Date().toISOString();
      domain.assertInvariants(state);
      await client.query('UPDATE app_state SET payload=$1::jsonb, revision=$2, updated_at=NOW() WHERE id=1', [JSON.stringify(state), state.stateRevision]);
      await client.query('INSERT INTO audit_events (action, actor, detail, revision) VALUES ($1,$2,$3,$4)', ['PROCESS_EXPIRY', 'system', `${count} pesanan kedaluwarsa diproses.`, state.stateRevision]);
    }
    await client.query('COMMIT');
    return domain.deepClone(state);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function read(options = {}) {
  return DRIVER === 'postgres' ? readPostgres(options) : readFile(options);
}

async function reset(actor = 'admin') {
  return transaction((state) => {
    const fresh = createSeed(new Date());
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, fresh);
    return { resetAt: fresh.generatedAt };
  }, { action: 'RESET_DEMO', actor, detail: 'Seed dibuat ulang menggunakan waktu server saat reset.' });
}

async function appendAudit(entry) {
  if (DRIVER === 'file') return appendAuditFile(entry);
  const pg = await getPool();
  await pg.query('INSERT INTO audit_events (action, actor, detail, revision, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)', [entry.action || 'AUDIT', entry.actor || 'system', entry.detail || '', entry.revision || null, JSON.stringify(entry.metadata || {})]);
}

async function createSession(session) {
  if (DRIVER === 'postgres') {
    const pg = await getPool();
    await pg.query(`INSERT INTO admin_sessions (token_hash, username, csrf_token, expires_at, device_hash, created_at, last_seen_at)
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      ON CONFLICT (token_hash) DO UPDATE SET username=EXCLUDED.username, csrf_token=EXCLUDED.csrf_token, expires_at=EXCLUDED.expires_at, device_hash=EXCLUDED.device_hash, last_seen_at=NOW()`,
    [session.tokenHash, session.username, session.csrf, new Date(session.expiresAt), session.deviceHash || null]);
    return;
  }
  return enqueueFileMetadata(() => {
    const sessions = readJsonFile(SESSION_FILE, []).filter((item) => item.expiresAt > Date.now() && item.tokenHash !== session.tokenHash);
    sessions.push(session);
    atomicWriteJson(SESSION_FILE, sessions);
  });
}

async function getSession(tokenHash) {
  if (DRIVER === 'postgres') {
    const pg = await getPool();
    const row = await pg.query('SELECT token_hash, username, csrf_token, expires_at, device_hash FROM admin_sessions WHERE token_hash=$1 AND expires_at > NOW()', [tokenHash]);
    if (!row.rowCount) return null;
    return { tokenHash: row.rows[0].token_hash, username: row.rows[0].username, csrf: row.rows[0].csrf_token, expiresAt: new Date(row.rows[0].expires_at).getTime(), deviceHash: row.rows[0].device_hash };
  }
  const sessions = readJsonFile(SESSION_FILE, []);
  return sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > Date.now()) || null;
}

async function touchSession(tokenHash, expiresAt) {
  if (DRIVER === 'postgres') {
    const pg = await getPool();
    await pg.query('UPDATE admin_sessions SET expires_at=$2, last_seen_at=NOW() WHERE token_hash=$1', [tokenHash, new Date(expiresAt)]);
    return;
  }
  return enqueueFileMetadata(() => {
    const sessions = readJsonFile(SESSION_FILE, []).filter((item) => item.expiresAt > Date.now());
    const item = sessions.find((entry) => entry.tokenHash === tokenHash);
    if (item) item.expiresAt = expiresAt;
    atomicWriteJson(SESSION_FILE, sessions);
  });
}

async function deleteSession(tokenHash) {
  if (DRIVER === 'postgres') {
    const pg = await getPool();
    await pg.query('DELETE FROM admin_sessions WHERE token_hash=$1', [tokenHash]);
    return;
  }
  return enqueueFileMetadata(() => atomicWriteJson(SESSION_FILE, readJsonFile(SESSION_FILE, []).filter((item) => item.tokenHash !== tokenHash)));
}

async function cleanupSessions() {
  if (DRIVER === 'postgres') {
    const pg = await getPool();
    await pg.query('DELETE FROM admin_sessions WHERE expires_at <= NOW()');
    await pg.query('DELETE FROM trusted_devices WHERE expires_at <= NOW()');
    return;
  }
  return enqueueFileMetadata(() => {
    atomicWriteJson(SESSION_FILE, readJsonFile(SESSION_FILE, []).filter((item) => item.expiresAt > Date.now()));
    atomicWriteJson(TRUSTED_DEVICE_FILE, readJsonFile(TRUSTED_DEVICE_FILE, []).filter((item) => item.expiresAt > Date.now()));
  });
}

async function trustDevice(record) {
  if (DRIVER === 'postgres') {
    const pg = await getPool();
    await pg.query(`INSERT INTO trusted_devices (device_hash, username, expires_at, created_at, last_seen_at)
      VALUES ($1,$2,$3,NOW(),NOW()) ON CONFLICT (device_hash) DO UPDATE SET username=EXCLUDED.username, expires_at=EXCLUDED.expires_at, last_seen_at=NOW()`,
    [record.deviceHash, record.username, new Date(record.expiresAt)]);
    return;
  }
  return enqueueFileMetadata(() => {
    const devices = readJsonFile(TRUSTED_DEVICE_FILE, []).filter((item) => item.expiresAt > Date.now() && item.deviceHash !== record.deviceHash);
    devices.push(record);
    atomicWriteJson(TRUSTED_DEVICE_FILE, devices);
  });
}

async function isTrustedDevice(deviceHash, username) {
  if (!deviceHash) return false;
  if (DRIVER === 'postgres') {
    const pg = await getPool();
    const row = await pg.query('SELECT 1 FROM trusted_devices WHERE device_hash=$1 AND username=$2 AND expires_at > NOW()', [deviceHash, username]);
    return Boolean(row.rowCount);
  }
  return readJsonFile(TRUSTED_DEVICE_FILE, []).some((item) => item.deviceHash === deviceHash && item.username === username && item.expiresAt > Date.now());
}

function enqueueFileMetadata(task) {
  const pending = fileQueue.then(task, task);
  fileQueue = pending.catch(() => undefined);
  return pending;
}


async function consumeRateLimit(limitKey, { max, windowMs, message }) {
  if (DRIVER !== 'postgres') return { allowed: true, count: 1, remaining: Math.max(0, max - 1) };
  const pg = await getPool();
  const windowSeconds = Math.max(1, Math.ceil(Number(windowMs || 60000) / 1000));
  const row = await pg.query(`
    INSERT INTO rate_limits (limit_key, count, window_started_at, expires_at)
    VALUES ($1, 1, NOW(), NOW() + make_interval(secs => $2))
    ON CONFLICT (limit_key) DO UPDATE SET
      count = CASE WHEN rate_limits.expires_at <= NOW() THEN 1 ELSE rate_limits.count + 1 END,
      window_started_at = CASE WHEN rate_limits.expires_at <= NOW() THEN NOW() ELSE rate_limits.window_started_at END,
      expires_at = CASE WHEN rate_limits.expires_at <= NOW() THEN NOW() + make_interval(secs => $2) ELSE rate_limits.expires_at END
    RETURNING count, expires_at
  `, [limitKey, windowSeconds]);
  const count = Number(row.rows[0].count || 0);
  if (count > max) throw Object.assign(new Error(message || 'Terlalu banyak permintaan. Coba lagi nanti.'), { statusCode: 429 });
  return { allowed: true, count, remaining: Math.max(0, max - count), resetAt: new Date(row.rows[0].expires_at).getTime() };
}

async function clearRateLimit(limitKey) {
  if (DRIVER !== 'postgres') return;
  const pg = await getPool();
  await pg.query('DELETE FROM rate_limits WHERE limit_key=$1', [limitKey]);
}

async function cleanupRateLimits() {
  if (DRIVER !== 'postgres') return;
  const pg = await getPool();
  await pg.query('DELETE FROM rate_limits WHERE expires_at <= NOW()');
}


async function healthCheck() {
  if (DRIVER === 'postgres') {
    const pg = await getPool();
    const started = Date.now();
    await pg.query('SELECT 1');
    return { ok: true, driver: DRIVER, latencyMs: Date.now() - started };
  }
  initializeFile();
  fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
  return { ok: true, driver: DRIVER, latencyMs: 0 };
}

async function close() {
  if (pool) await pool.end();
  pool = null;
}

module.exports = {
  ROOT, PUBLIC_ROOT, DATA_DIR, STATE_FILE, AUDIT_FILE, SESSION_FILE, TRUSTED_DEVICE_FILE, DRIVER,
  createSeed, createRuntimeSeed, initialize, read, transaction, reset, appendAudit,
  createSession, getSession, touchSession, deleteSession, cleanupSessions, trustDevice, isTrustedDevice,
  consumeRateLimit, clearRateLimit, cleanupRateLimits, healthCheck, close
};
