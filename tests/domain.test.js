'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../server/database');
const domain = require('../server/domain');

function seed(now = new Date()) {
  return db.createSeed(now);
}

test('reset seed selalu menghitung ulang deadline dari waktu baru', () => {
  const now = new Date('2026-07-24T05:00:00.000Z');
  const state = seed(now);
  const pending = state.orders.find((order) => order.id === 'order-003');
  assert.ok(new Date(pending.paymentDeadline).getTime() > now.getTime());
  assert.equal(state.version, '4.0.0');
});

test('waktu pengiriman seed konsisten pada Asia/Jakarta', () => {
  const state = seed(new Date('2026-07-24T23:30:00.000Z'));
  const delivery = new Date(state.batches[0].deliveryAt);
  const jakartaHour = new Date(delivery.getTime() + 7 * 3600000).getUTCHours();
  assert.equal(jakartaHour, 10);
});

test('batch yang ditutup admin tetap tertutup saat pembuka kedaluwarsa', () => {
  const state = seed();
  domain.updateBatch(state, 'batch-004', { status: 'CLOSED' });
  domain.rejectOrExpireOrder(state, 'order-004', 'EXPIRED');
  const batch = state.batches.find((item) => item.id === 'batch-004');
  assert.equal(batch.status, 'CLOSED');
  assert.equal(batch.closedByAdmin, true);
  assert.equal(batch.heldQty, 0);
});

test('batch yang ditutup admin tetap tertutup saat pembuka diverifikasi', () => {
  const state = seed();
  domain.updateBatch(state, 'batch-004', { status: 'CLOSED' });
  domain.verifyOrder(state, 'order-004');
  const batch = state.batches.find((item) => item.id === 'batch-004');
  assert.equal(batch.status, 'CLOSED');
  assert.equal(batch.soldQty, 10);
  assert.equal(batch.heldQty, 0);
});

test('kapasitas tidak dapat lebih kecil dari kuota tertahan', () => {
  const state = seed();
  assert.throws(() => domain.updateMenu(state, 'menu-004', { defaultCapacity: 5 }), /Kapasitas minimal 10/);
  assert.throws(() => domain.updateBatch(state, 'batch-004', { capacity: 5 }), /Kapasitas/);
});

test('checkout memvalidasi data pelanggan dan format nomor pesanan', () => {
  const state = seed();
  assert.throws(() => domain.createOrder(state, {
    customerName: '', phone: '', fulfillment: 'PICKUP', paymentMethod: 'QRIS', cart: [{ batchId: 'batch-001', qty: 1 }]
  }), /Nama pelanggan/);
  const order = domain.createOrder(state, {
    customerName: 'Rina Uji', phone: '081234567890', fulfillment: 'PICKUP', paymentMethod: 'QRIS', cart: [{ batchId: 'batch-001', qty: 1 }]
  });
  assert.match(order.code, /^DR-\d{6}-\d{4}$/);
  domain.assertInvariants(state);
});

test('close all mencakup batch pembuka yang menunggu pembayaran', () => {
  const state = seed();
  domain.closeAllOpenBatches(state);
  const opener = state.batches.find((item) => item.id === 'batch-004');
  assert.equal(opener.status, 'CLOSED');
  assert.equal(opener.closedByAdmin, true);
});

test('multi-batch untuk menu yang sama dapat dibuat', () => {
  const state = seed();
  const count = state.batches.filter((item) => item.menuId === 'menu-001').length;
  domain.addBatch(state, {
    menuId: 'menu-001', status: 'DRAFT', capacity: 40, openerMin: 10, price: 25000,
    closesAt: '2026-07-26T10:00:00.000Z', deliveryAt: '2026-07-27T03:00:00.000Z'
  });
  assert.equal(state.batches.filter((item) => item.menuId === 'menu-001').length, count + 1);
});

test('bulk siap diterima membedakan pickup dan delivery', () => {
  const state = seed();
  domain.bulkProductionStatus(state, 'READY');
  const pickup = state.orders.find((item) => item.id === 'order-002');
  const delivery = state.orders.find((item) => item.id === 'order-001');
  assert.equal(pickup.orderStatus, 'READY_FOR_PICKUP');
  assert.equal(delivery.orderStatus, 'READY_FOR_DELIVERY');
});


test('nama bukti tanpa file server tidak dianggap sebagai bukti pembayaran', () => {
  const state = seed();
  const order = domain.createOrder(state, {
    customerName: 'Bukti Palsu', phone: '081234567866', fulfillment: 'PICKUP', paymentMethod: 'QRIS',
    proofName: 'palsu.png', cart: [{ batchId: 'batch-001', qty: 1 }]
  });
  assert.equal(order.paymentStatus, 'UNPAID');
  assert.equal(order.proofName, '');
  assert.equal(order.proofPath, '');
});

test('urutan menu dan testimoni divalidasi di server', () => {
  const state = seed();
  domain.updateMenu(state, 'menu-001', { sortOrder: 25 });
  assert.equal(state.menus.find((item) => item.id === 'menu-001').sortOrder, 25);
  domain.updateTestimonial(state, 'testimonial-001', { sortOrder: 9 });
  assert.equal(state.testimonials.find((item) => item.id === 'testimonial-001').sortOrder, 9);
  assert.throws(() => domain.updateMenu(state, 'menu-001', { sortOrder: 0 }), /Urutan menu/);
});

test('seed produksi dimulai tanpa pesanan dan data uji coba', () => {
  const state = db.createRuntimeSeed(new Date(), 'PRODUCTION');
  assert.equal(state.settings.operationMode, 'PRODUCTION');
  assert.equal(state.settings.demoMode, false);
  assert.equal(state.orders.length, 0);
  assert.equal(state.notifications.length, 0);
  assert.equal(state.testimonials.length, 0);
  assert.ok(state.batches.every((batch) => batch.status === 'DRAFT' && batch.soldQty === 0 && batch.heldQty === 0 && batch.isDemo === false));
});
