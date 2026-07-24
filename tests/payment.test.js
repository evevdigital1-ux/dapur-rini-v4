'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../server/database');
const domain = require('../server/domain');

function seed() {
  return db.createSeed(new Date());
}

function createManualOrder(state, overrides = {}) {
  const created = domain.createOrder(state, {
    customerName: 'Pelanggan Produksi',
    phone: '081234567812',
    fulfillment: 'PICKUP',
    address: '',
    note: '',
    paymentMethod: 'BANK_TRANSFER',
    cart: [{ batchId: 'batch-001', qty: 1 }],
    ...overrides
  });
  return state.orders.find((order) => order.id === created.id);
}

function submitProof(state, order, overrides = {}) {
  return domain.submitPaymentProof(state, order.id, {
    proofKey: `proof-${Date.now()}-1234567890abcdef.png`,
    proofMime: 'image/png',
    proofName: 'bukti.png',
    senderName: order.customerName,
    reportedAmount: order.total,
    paidAt: new Date().toISOString(),
    ...overrides
  });
}

test('transfer manual memakai alur buat pesanan lalu unggah bukti', () => {
  const state = seed();
  const batch = state.batches.find((item) => item.id === 'batch-001');
  const heldBefore = batch.heldQty;
  const soldBefore = batch.soldQty;
  const order = createManualOrder(state);
  assert.equal(order.paymentStatus, 'UNPAID');
  assert.equal(order.orderStatus, 'WAITING_PAYMENT');
  assert.equal(order.proofKey, '');
  assert.equal(batch.heldQty, heldBefore + 1);
  assert.equal(batch.soldQty, soldBefore);

  submitProof(state, order);
  assert.equal(order.paymentStatus, 'PENDING_REVIEW');
  assert.ok(order.proofUploadedAt);

  domain.reviewPayment(state, order.id, 'RECEIVE', { actor: 'pemilik' });
  assert.equal(order.paymentStatus, 'PAID');
  assert.equal(order.orderStatus, 'CONFIRMED');
  assert.equal(batch.heldQty, heldBefore);
  assert.equal(batch.soldQty, soldBefore + 1);
  domain.assertInvariants(state);
});

test('pembayaran yang sama tidak dapat menambah penjualan dua kali', () => {
  const state = seed();
  const order = createManualOrder(state, { phone: '081234567813' });
  const batch = state.batches.find((item) => item.id === 'batch-001');
  submitProof(state, order);
  domain.reviewPayment(state, order.id, 'RECEIVE');
  const soldAfterFirstReview = batch.soldQty;
  domain.reviewPayment(state, order.id, 'RECEIVE');
  assert.equal(batch.soldQty, soldAfterFirstReview);
});

test('pemilik dapat memindahkan pembayaran ke cek lagi dan meminta bukti baru', () => {
  const state = seed();
  const order = createManualOrder(state, { phone: '081234567814' });
  submitProof(state, order);
  domain.reviewPayment(state, order.id, 'CHECK_LATER', { reason: 'Dana belum terlihat.' });
  assert.equal(order.paymentStatus, 'CHECK_LATER');
  domain.reviewPayment(state, order.id, 'REQUEST_NEW_PROOF', { reason: 'Bukti tidak jelas.' });
  assert.equal(order.paymentStatus, 'NEED_NEW_PROOF');
  assert.equal(order.reviewReason, 'Bukti tidak jelas.');
});

test('tunai saat pickup langsung masuk produksi tanpa bukti transfer', () => {
  const state = seed();
  const batch = state.batches.find((item) => item.id === 'batch-001');
  const soldBefore = batch.soldQty;
  const heldBefore = batch.heldQty;
  const order = domain.createOrder(state, {
    customerName: 'Tunai Pickup', phone: '081234567815', fulfillment: 'PICKUP', address: '', note: '',
    paymentMethod: 'CASH_PICKUP', cart: [{ batchId: 'batch-001', qty: 1 }]
  });
  assert.equal(order.paymentStatus, 'CASH_DUE');
  assert.equal(order.orderStatus, 'CONFIRMED');
  assert.equal(order.paymentDeadline, null);
  assert.equal(batch.soldQty, soldBefore + 1);
  assert.equal(batch.heldQty, heldBefore);
  domain.updateOrderStatus(state, order.id, 'COMPLETED');
  const stored = state.orders.find((item) => item.id === order.id);
  assert.equal(stored.paymentStatus, 'PAID');
  assert.ok(stored.verifiedAt);
});

test('tunai saat pickup ditolak untuk pesanan yang dikirim', () => {
  const state = seed();
  assert.throws(() => domain.createOrder(state, {
    customerName: 'Tunai Kirim', phone: '081234567816', fulfillment: 'LALAMOVE', address: 'Jalan Uji Nomor 10 Jakarta', note: '',
    paymentMethod: 'CASH_PICKUP', cart: [{ batchId: 'batch-001', qty: 1 }]
  }), /tunai/i);
});

test('pembayaran terlambat dapat diperiksa dan diterima ketika kuota masih tersedia', () => {
  const state = seed();
  const order = createManualOrder(state, { phone: '081234567817' });
  const batch = state.batches.find((item) => item.id === 'batch-001');
  const soldBefore = batch.soldQty;
  domain.rejectOrExpireOrder(state, order.id, 'EXPIRED');
  assert.equal(order.paymentStatus, 'EXPIRED');
  submitProof(state, order, { senderName: 'Pelanggan Terlambat' });
  assert.equal(order.paymentStatus, 'LATE_PAYMENT_REVIEW');
  domain.reviewPayment(state, order.id, 'RECEIVE', { actor: 'pemilik' });
  assert.equal(order.paymentStatus, 'PAID');
  assert.equal(batch.soldQty, soldBefore + 1);
});

test('pengembalian dana memakai dua langkah yang tercatat', () => {
  const state = seed();
  const batch = state.batches.find((item) => item.id === 'batch-001');
  const heldBefore = batch.heldQty;
  const order = createManualOrder(state, { phone: '081234567818' });
  assert.equal(batch.heldQty, heldBefore + 1);
  submitProof(state, order);
  domain.reviewPayment(state, order.id, 'REFUND_REQUIRED', { actor: 'pemilik', reason: 'Pesanan tidak dapat dipenuhi.', amount: order.total });
  assert.equal(order.paymentStatus, 'REFUND_PENDING');
  assert.equal(order.refundStatus, 'PENDING');
  assert.equal(batch.heldQty, heldBefore);
  domain.confirmRefund(state, order.id, { actor: 'pemilik', note: 'Dikembalikan melalui transfer.' });
  assert.equal(order.paymentStatus, 'REFUNDED');
  assert.equal(order.refundStatus, 'REFUNDED');
  assert.ok(order.refundedAt);
});
