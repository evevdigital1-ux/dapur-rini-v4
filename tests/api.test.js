'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const port = 18080 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
let server;
let dataDir;
let uploadDir;
let privateStorageDir;

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Server pengujian tidak siap.');
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json();
  return { response, payload };
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dapur-rini-data-'));
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dapur-rini-upload-'));
  privateStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dapur-rini-private-'));
  server = spawn(process.execPath, ['server/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DAPUR_RINI_DATA_DIR: dataDir, DAPUR_RINI_UPLOAD_DIR: uploadDir, DAPUR_RINI_PRIVATE_STORAGE_DIR: privateStorageDir },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer();
});

test.after(() => {
  server?.kill('SIGTERM');
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(uploadDir, { recursive: true, force: true });
  fs.rmSync(privateStorageDir, { recursive: true, force: true });
});

test('API publik tidak membocorkan daftar pesanan', async () => {
  const { response, payload } = await jsonFetch(`${base}/api/state`);
  assert.equal(response.status, 200);
  assert.equal(payload.authenticated, false);
  assert.equal(payload.state.orders, undefined);
  assert.ok(Array.isArray(payload.state.menus));
});

test('login membuat cookie HttpOnly dan state admin', async () => {
  const login = await jsonFetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'rini123' }) });
  assert.equal(login.response.status, 200);
  assert.match(login.response.headers.get('set-cookie') || '', /HttpOnly/);
  assert.ok(login.payload.csrfToken);
});

test('dua checkout paralel menghasilkan kode unik tanpa lost update', async () => {
  const makePayload = (name, phone) => ({ command: 'createOrder', payload: { customerName: name, phone, fulfillment: 'PICKUP', address: '', note: '', paymentMethod: 'QRIS', proofName: '', cart: [{ batchId: 'batch-001', qty: 1 }] } });
  const [a, b] = await Promise.all([
    jsonFetch(`${base}/api/command`, { method: 'POST', body: JSON.stringify(makePayload('Paralel Satu', '081234567801')) }),
    jsonFetch(`${base}/api/command`, { method: 'POST', body: JSON.stringify(makePayload('Paralel Dua', '081234567802')) })
  ]);
  assert.equal(a.response.status, 200);
  assert.equal(b.response.status, 200);
  assert.notEqual(a.payload.result.code, b.payload.result.code);
  assert.match(a.payload.result.code, /^DR-\d{6}-\d{4}$/);
});

test('tracking memerlukan kombinasi kode dan telepon', async () => {
  const create = await jsonFetch(`${base}/api/command`, { method: 'POST', body: JSON.stringify({ command: 'createOrder', payload: { customerName: 'Pelacak Uji', phone: '081234567899', fulfillment: 'PICKUP', address: '', note: '', paymentMethod: 'QRIS', proofName: '', cart: [{ batchId: 'batch-001', qty: 1 }] } }) });
  const code = create.payload.result.code;
  const wrong = await jsonFetch(`${base}/api/track?code=${encodeURIComponent(code)}&phone=081200000000`);
  assert.equal(wrong.response.status, 404);
  const correct = await jsonFetch(`${base}/api/track?code=${encodeURIComponent(code)}&phone=081234567899`);
  assert.equal(correct.response.status, 200);
  assert.equal(correct.payload.order.code, code);
  assert.equal(correct.payload.order.phone, undefined);
});

test('static server menolak file sensitif dan traversal', async () => {
  for (const pathname of ['/server/data/state.json', '/server/server.js', '/package.json', '/tests/api.test.js', '/assets/../server/server.js', '/assets/%2e%2e/server/server.js']) {
    const response = await fetch(`${base}${pathname}`);
    assert.ok([403, 404].includes(response.status), `${pathname} menghasilkan ${response.status}`);
  }
});

test('mutasi admin memerlukan cookie sesi dan CSRF', async () => {
  const login = await jsonFetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'rini123' }) });
  const cookie = (login.response.headers.get('set-cookie') || '').split(';')[0];
  const body = JSON.stringify({ command: 'markAllNotificationsRead', payload: {} });
  const noCsrf = await jsonFetch(`${base}/api/command`, { method: 'POST', headers: { Cookie: cookie }, body });
  assert.equal(noCsrf.response.status, 403);
  const valid = await jsonFetch(`${base}/api/command`, { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': login.payload.csrfToken }, body });
  assert.equal(valid.response.status, 200);
});

test('bukti pembayaran hanya dapat dibuka oleh sesi admin', async () => {
  const proofData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const create = await jsonFetch(`${base}/api/command`, { method: 'POST', body: JSON.stringify({ command: 'createOrder', payload: { customerName: 'Bukti Uji', phone: '081234567877', fulfillment: 'PICKUP', address: '', note: '', paymentMethod: 'QRIS_STATIC', cart: [{ batchId: 'batch-001', qty: 1 }] } }) });
  assert.equal(create.response.status, 200);
  assert.equal(create.payload.result.paymentStatus, 'UNPAID');

  const upload = await jsonFetch(`${base}/api/payment-proof`, { method: 'POST', body: JSON.stringify({
    code: create.payload.result.code,
    phone: '081234567877',
    proofName: 'bukti.png',
    proofData,
    senderName: 'Bukti Uji',
    reportedAmount: create.payload.result.total,
    paidAt: new Date().toISOString()
  }) });
  assert.equal(upload.response.status, 200);
  assert.equal(upload.payload.order.paymentStatus, 'PENDING_REVIEW');

  const login = await jsonFetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'rini123' }) });
  const cookie = (login.response.headers.get('set-cookie') || '').split(';')[0];
  const adminStateResponse = await jsonFetch(`${base}/api/state`, { headers: { Cookie: cookie } });
  const order = adminStateResponse.payload.state.orders.find((item) => item.code === create.payload.result.code);
  assert.match(order.proofKey, /^proof-/);

  const proofPath = `/api/proofs/${encodeURIComponent(order.proofKey)}`;
  const publicResponse = await fetch(`${base}${proofPath}`);
  assert.equal(publicResponse.status, 401);
  const adminResponse = await fetch(`${base}${proofPath}`, { headers: { Cookie: cookie } });
  assert.equal(adminResponse.status, 200);
  assert.equal(adminResponse.headers.get('content-type'), 'image/png');
});


test('QRIS disimpan melalui media storage dan dapat ditampilkan publik', async () => {
  const proofData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const login = await jsonFetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'rini123' }) });
  const cookie = (login.response.headers.get('set-cookie') || '').split(';')[0];
  const update = await jsonFetch(`${base}/api/command`, {
    method: 'POST',
    headers: { Cookie: cookie, 'X-CSRF-Token': login.payload.csrfToken },
    body: JSON.stringify({ command: 'updateSettings', payload: { patch: { bankAccount: '1234567890' }, qrisImageData: proofData } })
  });
  assert.equal(update.response.status, 200);
  const mediaUrl = update.payload.state.settings.qrisImage;
  assert.match(mediaUrl, /^\/api\/media\//);
  const media = await fetch(`${base}${mediaUrl}`);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/png');
});

test('rate limit lokal membatasi percobaan login berulang', async () => {
  for (let index = 0; index < 5; index += 1) {
    const attempt = await jsonFetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ username: 'admin', password: `salah-${index}` }) });
    assert.equal(attempt.response.status, 401);
  }
  const blocked = await jsonFetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'masih-salah' }) });
  assert.equal(blocked.response.status, 429);
});
