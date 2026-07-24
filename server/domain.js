'use strict';

const crypto = require('crypto');

const BATCH_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'WAITING_OPENER', 'OPENER_PENDING_PAYMENT', 'OPEN', 'CLOSING_SOON', 'SOLD_OUT', 'CLOSED', 'CANCELLED', 'IN_PRODUCTION', 'READY', 'COMPLETED']);
const PAYMENT_STATUSES_FINAL = new Set(['PAID', 'CASH_DUE', 'EXPIRED', 'REJECTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'LATE_PAYMENT_REVIEW']);
const ORDER_STATUSES = new Set(['WAITING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'READY_FOR_PICKUP', 'READY_FOR_DELIVERY', 'ON_DELIVERY', 'COMPLETED', 'CANCELLED']);
const FULFILLMENTS = new Set(['PICKUP', 'LALAMOVE']);
const PAYMENT_METHODS = new Set(['BANK_TRANSFER', 'QRIS_STATIC', 'CASH_PICKUP', 'TRANSFER_BCA', 'QRIS']);
const ACTIVE_BATCH_STATUSES = new Set(['WAITING_OPENER', 'OPEN', 'CLOSING_SOON']);
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

const deepClone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = (clock = Date) => new clock().toISOString();
const uid = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;

function cleanText(value, name, { min = 0, max = 250, required = false } = {}) {
  const text = String(value ?? '').trim();
  if (required && text.length < Math.max(1, min)) throw new Error(`${name} wajib diisi.`);
  if (text.length < min) throw new Error(`${name} terlalu pendek.`);
  if (text.length > max) throw new Error(`${name} maksimal ${max} karakter.`);
  return text;
}

function positiveInteger(value, name, { min = 1, max = 100000 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${name} harus bilangan bulat antara ${min} dan ${max}.`);
  return number;
}

function nonNegativeNumber(value, name, { max = 1000000000 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) throw new Error(`${name} tidak valid.`);
  return number;
}

function validIso(value, name) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new Error(`${name} tidak valid.`);
  return new Date(time).toISOString();
}

function normalizePhone(value) {
  const raw = cleanText(value, 'Nomor telepon', { required: true, min: 8, max: 24 });
  const digits = raw.replace(/\D/g, '');
  if (!/^(?:62|0)8\d{7,12}$/.test(digits)) throw new Error('Nomor telepon Indonesia tidak valid.');
  return raw;
}

function normalizeWhatsApp(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (!/^628\d{7,12}$/.test(digits)) throw new Error('Nomor WhatsApp harus menggunakan format 628xxxxxxxxxx.');
  return digits;
}

function ensureCollections(state) {
  state.cart = [];
  state.activityLogs ||= [];
  state.notifications ||= [];
  state.testimonials ||= [];
  if (Array.isArray(state.testimonials)) {
    state.testimonials.forEach((item) => {
      if (item.isDemo || /Maya|Rina|Bu Sari/i.test(item.name)) {
        item.name = 'Testimoni WhatsApp';
        item.menuName = '';
        item.caption = '';
      }
    });
  }
  if (Array.isArray(state.menus)) {
    const bugis = state.menus.find((m) => m.id === 'menu-014' || /Bugis Ketan/i.test(m.name));
    if (bugis) bugis.image = 'assets/images/bugis-ketan-v4.webp';
  }
  state.settings ||= {};
  state.orders ||= [];
  state.menus ||= [];
  state.batches ||= [];
  state.stateRevision = Number(state.stateRevision || 1);
  state.orderSequences ||= {};
  state.settings.paymentTimeoutMinutes = Number(state.settings.paymentTimeoutMinutes || 60);
  state.settings.expiryWarningMinutes = Number(state.settings.expiryWarningMinutes || 15);
  state.settings.autoCancelUnverified = state.settings.autoCancelUnverified !== false;
  state.settings.notificationSound = state.settings.notificationSound !== false;
  state.settings.sessionTimeoutMinutes = Number(state.settings.sessionTimeoutMinutes || 30);
  state.settings.operationMode ||= 'DEMO';
  state.settings.bankAccount ||= '';
  state.settings.qrisImage ||= '';
  state.settings.cashPickupEnabled = state.settings.cashPickupEnabled !== false;
  return state;
}

function addLog(state, action, detail, actor = 'system') {
  state.activityLogs.unshift({ id: uid('log'), action, detail, actor, at: new Date().toISOString() });
  state.activityLogs = state.activityLogs.slice(0, 500);
}

function addNotification(state, payload) {
  const dedupeKey = payload.dedupeKey || '';
  if (dedupeKey && state.notifications.some((item) => item.dedupeKey === dedupeKey)) return null;
  const notification = {
    id: uid('notification'),
    type: payload.type || 'INFO',
    title: payload.title || 'Pemberitahuan',
    message: payload.message || '',
    orderId: payload.orderId || null,
    read: Boolean(payload.read),
    createdAt: payload.createdAt || new Date().toISOString(),
    channel: payload.channel || 'WEBSITE',
    dedupeKey
  };
  state.notifications.unshift(notification);
  state.notifications = state.notifications.slice(0, 300);
  return notification;
}

function availableQty(batch) {
  return Math.max(0, Number(batch.capacity || 0) - Number(batch.soldQty || 0) - Number(batch.heldQty || 0));
}

function requiredMin(batch) {
  return batch.status === 'WAITING_OPENER' ? Number(batch.openerMin || 1) : Number(batch.regularMin || 1);
}

function canPurchase(batch) {
  return ACTIVE_BATCH_STATUSES.has(batch.status) && !batch.closedByAdmin && availableQty(batch) >= requiredMin(batch);
}

function normalizeTimedStatus(batch, now = Date.now()) {
  const closes = new Date(batch.closesAt).getTime();
  if (batch.closedByAdmin || ['CLOSED', 'CANCELLED', 'COMPLETED'].includes(batch.status)) return batch;
  if (ACTIVE_BATCH_STATUSES.has(batch.status) && closes <= now) batch.status = 'CLOSED';
  if (batch.status === 'OPEN' && closes - now <= 2 * 60 * 60 * 1000 && closes > now) batch.status = 'CLOSING_SOON';
  if (batch.soldQty >= batch.capacity && ['OPEN', 'CLOSING_SOON'].includes(batch.status)) batch.status = 'SOLD_OUT';
  return batch;
}

function releaseOrderReservation(state, order) {
  order.items.forEach((line) => {
    const batch = state.batches.find((item) => item.id === line.batchId);
    if (!batch) return;
    batch.heldQty = Math.max(0, Number(batch.heldQty || 0) - Number(line.qty || 0));
    if (order.isOpener && batch.openerOrderId === order.id) {
      batch.openerOrderId = null;
      if (!batch.closedByAdmin && batch.status !== 'CLOSED') batch.status = 'WAITING_OPENER';
    }
  });
}

function processExpiredOrders(state, now = Date.now()) {
  ensureCollections(state);
  if (!state.settings.autoCancelUnverified) return 0;
  const warningMs = Number(state.settings.expiryWarningMinutes || 15) * 60000;
  let count = 0;
  state.orders.forEach((order) => {
    if (PAYMENT_STATUSES_FINAL.has(order.paymentStatus)) return;
    if (['COMPLETED', 'CANCELLED'].includes(order.orderStatus)) return;
    const deadline = new Date(order.paymentDeadline || 0).getTime();
    if (!deadline) return;
    const remaining = deadline - now;
    if (remaining <= 0) {
      releaseOrderReservation(state, order);
      order.paymentStatus = 'EXPIRED';
      order.orderStatus = 'CANCELLED';
      order.expiredAt = new Date(now).toISOString();
      order.paymentDeadline = null;
      order.cancelReason = 'Pembayaran belum diverifikasi dalam batas waktu.';
      addLog(state, 'AUTO_EXPIRE_ORDER', `${order.code} dibatalkan otomatis karena pembayaran belum diverifikasi.`);
      addNotification(state, { type: 'ORDER_EXPIRED', title: 'Pesanan dibatalkan otomatis', message: `${order.code} melewati batas pembayaran dan kuotanya telah dikembalikan.`, orderId: order.id, dedupeKey: `expired:${order.id}` });
      count += 1;
    } else if (remaining <= warningMs) {
      const minutes = Math.max(1, Math.ceil(remaining / 60000));
      addNotification(state, { type: 'EXPIRING_SOON', title: 'Pesanan segera kedaluwarsa', message: `${order.code} perlu diverifikasi dalam sekitar ${minutes} menit.`, orderId: order.id, dedupeKey: `warning:${order.id}` });
    }
  });
  state.batches.forEach((batch) => normalizeTimedStatus(batch, now));
  return count;
}

function dateCodeJakarta(date = new Date()) {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return `${String(shifted.getUTCFullYear()).slice(-2)}${String(shifted.getUTCMonth() + 1).padStart(2, '0')}${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function nextOrderCode(state, date = new Date()) {
  const key = dateCodeJakarta(date);
  const existingMax = state.orders
    .map((order) => new RegExp(`^DR-${key}-(\\d{4})$`).exec(order.code || ''))
    .filter(Boolean)
    .reduce((max, match) => Math.max(max, Number(match[1])), 0);
  const next = Math.max(Number(state.orderSequences[key] || 0), existingMax) + 1;
  state.orderSequences[key] = next;
  return `DR-${key}-${String(next).padStart(4, '0')}`;
}

function validateCart(state, cart) {
  if (!Array.isArray(cart) || !cart.length) throw new Error('Keranjang masih kosong.');
  const orderItems = [];
  let subtotal = 0;
  let isOpener = false;
  let deliveryDate = '';
  const seen = new Set();
  cart.forEach((raw) => {
    const batchId = cleanText(raw.batchId, 'Batch', { required: true, max: 80 });
    if (seen.has(batchId)) throw new Error('Item keranjang duplikat.');
    seen.add(batchId);
    const qty = positiveInteger(raw.qty, 'Jumlah pesanan', { min: 1, max: 10000 });
    const batch = state.batches.find((item) => item.id === batchId);
    const menu = state.menus.find((item) => item.id === batch?.menuId && item.active);
    if (!menu || !batch) throw new Error('Data menu berubah. Perbarui halaman dan coba lagi.');
    normalizeTimedStatus(batch);
    if (!canPurchase(batch)) throw new Error(`${menu.name} sudah tidak dapat dipesan.`);
    const minimum = requiredMin(batch);
    if (qty < minimum) throw new Error(`${menu.name} minimal ${minimum} ${menu.unit}.`);
    if (qty > availableQty(batch)) throw new Error(`Kuota ${menu.name} tidak mencukupi.`);
    const currentDeliveryDate = String(batch.deliveryAt).slice(0, 10);
    if (deliveryDate && currentDeliveryDate !== deliveryDate) throw new Error('Satu checkout hanya boleh memuat satu tanggal pengiriman.');
    deliveryDate = currentDeliveryDate;
    if (batch.status === 'WAITING_OPENER') isOpener = true;
    const line = { menuId: menu.id, batchId: batch.id, name: menu.name, image: menu.image || 'assets/images/jajan-pasar.webp', qty, unit: menu.unit, price: Number(batch.price), subtotal: Number(batch.price) * qty };
    subtotal += line.subtotal;
    orderItems.push(line);
  });
  if (isOpener && orderItems.length !== 1) throw new Error('Pesanan pembuka harus berada dalam checkout tersendiri.');
  return { orderItems, subtotal, isOpener };
}

function createOrder(state, payload) {
  ensureCollections(state);
  processExpiredOrders(state);
  const customerName = cleanText(payload.customerName, 'Nama pelanggan', { required: true, min: 2, max: 80 });
  const phone = normalizePhone(payload.phone);
  const fulfillment = cleanText(payload.fulfillment, 'Metode penerimaan', { required: true, max: 20 });
  if (!FULFILLMENTS.has(fulfillment)) throw new Error('Metode penerimaan tidak valid.');
  const paymentMethod = cleanText(payload.paymentMethod, 'Metode pembayaran', { required: true, max: 30 });
  if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('Metode pembayaran tidak valid.');
  if (paymentMethod === 'CASH_PICKUP' && fulfillment !== 'PICKUP') throw new Error('Pembayaran tunai hanya tersedia untuk pesanan pickup.');
  if (paymentMethod === 'CASH_PICKUP' && state.settings.cashPickupEnabled === false) throw new Error('Pembayaran tunai saat pickup sedang tidak tersedia.');
  const address = fulfillment === 'LALAMOVE' ? cleanText(payload.address, 'Alamat pengiriman', { required: true, min: 8, max: 300 }) : '';
  const note = cleanText(payload.note, 'Catatan', { max: 300 });
  const { orderItems, subtotal, isOpener } = validateCart(state, payload.cart);
  const createdAt = new Date().toISOString();
  const timeoutMinutes = positiveInteger(state.settings.paymentTimeoutMinutes, 'Batas pembayaran', { min: 5, max: 1440 });
  const code = nextOrderCode(state, new Date(createdAt));
  const deliveryFee = fulfillment === 'LALAMOVE' ? 18000 : 0;
  const order = {
    id: uid('order'), code, trackingToken: crypto.randomBytes(18).toString('base64url'), customerName, phone, fulfillment, address, note,
    paymentMethod, paymentStatus: paymentMethod === 'CASH_PICKUP' ? 'CASH_DUE' : 'UNPAID', orderStatus: paymentMethod === 'CASH_PICKUP' ? 'CONFIRMED' : 'WAITING_PAYMENT', proofName: '',
    proofKey: '', proofMime: '', proofUploadedAt: null, reportedSenderName: '', reportedAmount: null, reportedPaidAt: null, reviewReason: '', reviewedAt: null, reviewedBy: '', refundStatus: 'NONE', proofPath: '', createdAt, paymentDeadline: paymentMethod === 'CASH_PICKUP' ? null : new Date(new Date(createdAt).getTime() + timeoutMinutes * 60000).toISOString(),
    deliveryAt: state.batches.find((item) => item.id === orderItems[0].batchId).deliveryAt, isOpener, isDemo: state.settings.operationMode !== 'PRODUCTION',
    items: orderItems, subtotal, deliveryFee, total: subtotal + deliveryFee
  };
  state.orders.unshift(order);
  orderItems.forEach((line) => {
    const batch = state.batches.find((item) => item.id === line.batchId);
    batch.heldQty += line.qty;
    if (isOpener) {
      batch.status = 'OPENER_PENDING_PAYMENT';
      batch.openerOrderId = order.id;
    }
  });
  if (paymentMethod === 'CASH_PICKUP') confirmInventorySale(state, order);
  addLog(state, 'CREATE_ORDER', `${code} dibuat oleh ${customerName}.`, 'customer');
  addNotification(state, { type: 'NEW_ORDER', title: 'Pesanan baru masuk', message: `${customerName} membuat ${code} senilai Rp${Number(order.total).toLocaleString('id-ID')}.`, orderId: order.id, dedupeKey: `new:${order.id}` });
  addNotification(state, { type: 'MANUAL_WHATSAPP', title: 'Pesan pelanggan siap', message: `Pemilik dapat membuka WhatsApp untuk menindaklanjuti ${code}.`, orderId: order.id, channel: 'MANUAL_WHATSAPP', dedupeKey: `wa:${order.id}` });
  return deepClone(order);
}

function confirmInventorySale(state, order, { late = false } = {}) {
  order.items.forEach((line) => {
    const batch = state.batches.find((item) => item.id === line.batchId);
    if (!batch) throw new Error('Batch pesanan tidak ditemukan.');
    if (late) {
      normalizeTimedStatus(batch);
      if (availableQty(batch) < line.qty || batch.closedByAdmin || ['CANCELLED', 'COMPLETED'].includes(batch.status)) {
        throw new Error(`Kuota ${line.name} tidak tersedia untuk pembayaran terlambat.`);
      }
      batch.soldQty += line.qty;
    } else {
      if (Number(batch.heldQty || 0) < line.qty) throw new Error(`Kuota tertahan ${line.name} tidak konsisten.`);
      batch.heldQty = Math.max(0, batch.heldQty - line.qty);
      batch.soldQty += line.qty;
    }
    if (order.isOpener && batch.openerOrderId === order.id) {
      if (!batch.closedByAdmin && batch.status !== 'CLOSED') batch.status = batch.soldQty >= batch.capacity ? 'SOLD_OUT' : 'OPEN';
      batch.openerOrderId = order.id;
    } else if (!batch.closedByAdmin && batch.soldQty >= batch.capacity) batch.status = 'SOLD_OUT';
  });
}

function submitPaymentProof(state, orderId, payload) {
  ensureCollections(state);
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');
  if (['PAID', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED', 'REJECTED'].includes(order.paymentStatus)) throw new Error('Bukti pembayaran tidak dapat diubah untuk pesanan ini.');
  const proofKey = cleanText(payload.proofKey, 'Bukti pembayaran', { required: true, min: 10, max: 180 });
  order.proofKey = proofKey;
  order.proofMime = cleanText(payload.proofMime, 'Jenis bukti', { required: true, max: 80 });
  order.proofName = cleanText(payload.proofName, 'Nama bukti pembayaran', { required: true, min: 1, max: 180 });
  order.proofUploadedAt = new Date().toISOString();
  order.reportedSenderName = cleanText(payload.senderName, 'Nama pengirim', { required: true, min: 2, max: 100 });
  order.reportedAmount = nonNegativeNumber(payload.reportedAmount, 'Nominal pembayaran', { max: 1000000000 });
  order.reportedPaidAt = validIso(payload.paidAt, 'Waktu pembayaran');
  order.reviewReason = '';
  if (order.paymentStatus === 'EXPIRED' || order.orderStatus === 'CANCELLED') {
    order.paymentStatus = 'LATE_PAYMENT_REVIEW';
    order.orderStatus = 'CANCELLED';
  } else {
    order.paymentStatus = 'PENDING_REVIEW';
  }
  addLog(state, 'SUBMIT_PAYMENT_PROOF', `${order.code} mengunggah bukti pembayaran.`, 'customer');
  addNotification(state, { type: 'PAYMENT_REVIEW', title: 'Pembayaran perlu dicek', message: `${order.code} mengunggah bukti pembayaran.`, orderId: order.id, dedupeKey: `proof:${order.id}:${order.proofUploadedAt}` });
  return order;
}

function reviewPayment(state, orderId, decision, payload = {}) {
  ensureCollections(state);
  processExpiredOrders(state);
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');
  const actor = cleanText(payload.actor || 'admin', 'Pemeriksa', { required: true, max: 80 });
  const reason = cleanText(payload.reason || '', 'Alasan', { max: 220 });
  const now = new Date().toISOString();

  if (decision === 'RECEIVE') {
    if (order.paymentStatus === 'PAID') return order;
    if (!order.proofKey && !order.proofName && order.paymentMethod !== 'CASH_PICKUP') throw new Error('Bukti pembayaran belum tersedia.');
    const late = ['EXPIRED', 'LATE_PAYMENT_REVIEW'].includes(order.paymentStatus) || order.orderStatus === 'CANCELLED';
    if (['REJECTED', 'REFUND_PENDING', 'REFUNDED'].includes(order.paymentStatus)) throw new Error('Pembayaran ini tidak dapat diterima.');
    confirmInventorySale(state, order, { late });
    order.paymentStatus = 'PAID';
    order.orderStatus = 'CONFIRMED';
    order.verifiedAt = now;
    order.reviewedAt = now;
    order.reviewedBy = actor;
    order.reviewReason = '';
    order.paymentDeadline = null;
    addLog(state, late ? 'ACCEPT_LATE_PAYMENT' : 'VERIFY_PAYMENT', `${order.code} diterima oleh ${actor}.`, actor);
    addNotification(state, { type: 'PAYMENT_VERIFIED', title: 'Pembayaran diterima', message: `${order.code} masuk ke daftar produksi.`, orderId: order.id, dedupeKey: `verified:${order.id}` });
    return order;
  }

  if (order.paymentStatus === 'PAID') throw new Error('Pembayaran yang sudah diterima tidak dapat diubah melalui antrean ini.');
  if (['REJECTED', 'REFUND_PENDING', 'REFUNDED'].includes(order.paymentStatus)) throw new Error('Status pembayaran sudah final.');

  if (decision === 'CHECK_LATER') {
    order.paymentStatus = 'CHECK_LATER';
    order.reviewedAt = now;
    order.reviewedBy = actor;
    order.reviewReason = reason || 'Dana belum terlihat. Periksa kembali.';
    addLog(state, 'CHECK_PAYMENT_LATER', `${order.code} akan diperiksa kembali.`, actor);
    return order;
  }
  if (decision === 'REQUEST_NEW_PROOF') {
    order.paymentStatus = 'NEED_NEW_PROOF';
    order.reviewedAt = now;
    order.reviewedBy = actor;
    order.reviewReason = reason || 'Bukti pembayaran perlu diunggah ulang.';
    addLog(state, 'REQUEST_NEW_PROOF', `${order.code} diminta mengunggah bukti baru.`, actor);
    return order;
  }
  if (decision === 'REJECT') {
    if (!['EXPIRED', 'LATE_PAYMENT_REVIEW'].includes(order.paymentStatus) && order.orderStatus !== 'CANCELLED') releaseOrderReservation(state, order);
    order.paymentStatus = 'REJECTED';
    order.orderStatus = 'CANCELLED';
    order.paymentDeadline = null;
    order.cancelledAt = now;
    order.cancelReason = reason || 'Pembayaran tidak dapat ditemukan atau tidak sesuai.';
    order.reviewedAt = now;
    order.reviewedBy = actor;
    order.reviewReason = order.cancelReason;
    addLog(state, 'REJECT_PAYMENT', `${order.code} ditolak: ${order.cancelReason}`, actor);
    return order;
  }
  if (decision === 'REFUND_REQUIRED') {
    if (!['EXPIRED', 'LATE_PAYMENT_REVIEW'].includes(order.paymentStatus) && order.orderStatus !== 'CANCELLED') {
      releaseOrderReservation(state, order);
    }
    order.paymentStatus = 'REFUND_PENDING';
    order.refundStatus = 'PENDING';
    order.refundAmount = nonNegativeNumber(payload.amount ?? order.reportedAmount ?? order.total, 'Jumlah pengembalian');
    order.refundReason = reason || 'Pesanan tidak dapat dipenuhi.';
    order.refundRequestedAt = now;
    order.orderStatus = 'CANCELLED';
    order.paymentDeadline = null;
    addLog(state, 'MARK_REFUND_PENDING', `${order.code} perlu dikembalikan sebesar ${order.refundAmount}.`, actor);
    return order;
  }
  throw new Error('Keputusan pembayaran tidak valid.');
}

function verifyOrder(state, orderId) {
  return reviewPayment(state, orderId, 'RECEIVE', { actor: 'admin' });
}

function confirmRefund(state, orderId, payload = {}) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');
  if (order.paymentStatus !== 'REFUND_PENDING') throw new Error('Pesanan tidak berada pada tahap pengembalian dana.');
  const actor = cleanText(payload.actor || 'admin', 'Petugas', { required: true, max: 80 });
  order.paymentStatus = 'REFUNDED';
  order.refundStatus = 'REFUNDED';
  order.refundedAt = new Date().toISOString();
  order.refundedBy = actor;
  order.refundNote = cleanText(payload.note || '', 'Catatan pengembalian', { max: 300 });
  addLog(state, 'CONFIRM_REFUND', `${order.code} ditandai sudah dikembalikan.`, actor);
  return order;
}

function rejectOrExpireOrder(state, orderId, type) {
  if (!['REJECTED', 'EXPIRED'].includes(type)) throw new Error('Jenis pembatalan tidak valid.');
  if (type === 'REJECTED') return reviewPayment(state, orderId, 'REJECT', { actor: 'admin' });
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');
  if (order.paymentStatus === 'PAID') throw new Error('Pembayaran yang sudah diterima tidak dapat dibatalkan otomatis.');
  if (['EXPIRED', 'REJECTED'].includes(order.paymentStatus)) return order;
  releaseOrderReservation(state, order);
  order.paymentStatus = 'EXPIRED';
  order.orderStatus = 'CANCELLED';
  order.paymentDeadline = null;
  order.cancelledAt = new Date().toISOString();
  order.cancelReason = 'Batas pembayaran terlewati.';
  addLog(state, 'EXPIRE_ORDER', `${order.code} kedaluwarsa.`, 'admin');
  return order;
}

function extendPaymentDeadline(state, orderId, minutes) {
  const extra = positiveInteger(minutes, 'Durasi perpanjangan', { min: 1, max: 240 });
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');
  if (order.paymentStatus === 'PAID') throw new Error('Pesanan sudah dibayar.');
  if (['EXPIRED', 'REJECTED', 'CANCELLED'].includes(order.paymentStatus)) throw new Error('Pesanan sudah dibatalkan.');
  const base = Math.max(Date.now(), new Date(order.paymentDeadline || Date.now()).getTime());
  order.paymentDeadline = new Date(base + extra * 60000).toISOString();
  order.deadlineExtendedMinutes = Number(order.deadlineExtendedMinutes || 0) + extra;
  state.notifications = state.notifications.filter((item) => item.dedupeKey !== `warning:${order.id}`);
  addLog(state, 'EXTEND_PAYMENT_DEADLINE', `${order.code} diperpanjang ${extra} menit.`, 'admin');
  return order;
}

function updateOrderStatus(state, orderId, status) {
  if (!ORDER_STATUSES.has(status)) throw new Error('Status pesanan tidak valid.');
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');
  if (!['PAID', 'CASH_DUE'].includes(order.paymentStatus) && !['WAITING_PAYMENT', 'CANCELLED'].includes(status)) throw new Error('Pesanan belum dibayar.');
  if (status === 'READY_FOR_PICKUP' && order.fulfillment !== 'PICKUP') throw new Error('Status siap diambil hanya untuk pesanan pickup.');
  if (['READY_FOR_DELIVERY', 'ON_DELIVERY'].includes(status) && order.fulfillment !== 'LALAMOVE') throw new Error('Status pengiriman hanya untuk pesanan Lalamove.');
  order.orderStatus = status;
  if (status === 'COMPLETED' && order.paymentStatus === 'CASH_DUE') {
    const now = new Date().toISOString();
    order.paymentStatus = 'PAID';
    order.verifiedAt = now;
    order.reviewedAt = now;
    order.reviewedBy = 'cash-pickup';
    order.reviewReason = '';
    addLog(state, 'RECEIVE_CASH_PICKUP', `${order.code} menerima pembayaran tunai saat pickup.`, 'admin');
  }
  addLog(state, 'UPDATE_ORDER_STATUS', `${order.code} menjadi ${status}.`, 'admin');
  return order;
}

function bulkProductionStatus(state, status, deliveryDate = '') {
  if (!['IN_PRODUCTION', 'READY'].includes(status)) throw new Error('Tahap produksi massal tidak valid.');
  let count = 0;
  state.orders.filter((order) => ['PAID', 'CASH_DUE'].includes(order.paymentStatus) && !['CANCELLED', 'COMPLETED'].includes(order.orderStatus)).forEach((order) => {
    if (deliveryDate && String(order.deliveryAt).slice(0, 10) !== deliveryDate) return;
    if (status === 'IN_PRODUCTION') order.orderStatus = 'IN_PRODUCTION';
    else order.orderStatus = order.fulfillment === 'PICKUP' ? 'READY_FOR_PICKUP' : 'READY_FOR_DELIVERY';
    count += 1;
  });
  addLog(state, 'BULK_ORDER_STATUS', `${count} pesanan diperbarui ke tahap ${status}.`, 'admin');
  return count;
}

function updateBatch(state, batchId, patch) {
  const batch = state.batches.find((item) => item.id === batchId);
  if (!batch) throw new Error('Batch tidak ditemukan.');
  const next = {};
  if (patch.status !== undefined) {
    if (!BATCH_STATUSES.has(patch.status)) throw new Error('Status batch tidak valid.');
    next.status = patch.status;
  }
  if (patch.price !== undefined) next.price = nonNegativeNumber(patch.price, 'Harga batch');
  if (patch.openerMin !== undefined) next.openerMin = positiveInteger(patch.openerMin, 'Minimum pembuka', { min: 1, max: 10000 });
  if (patch.capacity !== undefined) {
    const minCapacity = Number(batch.soldQty || 0) + Number(batch.heldQty || 0);
    next.capacity = positiveInteger(patch.capacity, 'Kapasitas', { min: Math.max(1, minCapacity), max: 100000 });
  }
  if (patch.closesAt !== undefined) next.closesAt = validIso(patch.closesAt, 'Waktu tutup');
  if (patch.deliveryAt !== undefined) next.deliveryAt = validIso(patch.deliveryAt, 'Waktu pengiriman');
  if (patch.deliveryEndAt !== undefined) next.deliveryEndAt = validIso(patch.deliveryEndAt, 'Batas akhir pengiriman');
  Object.assign(batch, next);
  if (next.status === 'CLOSED') {
    batch.closedByAdmin = true;
    batch.closedAt = new Date().toISOString();
    batch.closeReason = 'Ditutup oleh admin.';
  } else if (next.status && !['CANCELLED', 'COMPLETED'].includes(next.status)) {
    batch.closedByAdmin = false;
    batch.closedAt = null;
    batch.closeReason = '';
  }
  addLog(state, 'UPDATE_BATCH', `${batchId} diperbarui.`, 'admin');
  return batch;
}

function closeAllOpenBatches(state) {
  let count = 0;
  state.batches.forEach((batch) => {
    if (['OPEN', 'CLOSING_SOON', 'WAITING_OPENER', 'OPENER_PENDING_PAYMENT'].includes(batch.status)) {
      batch.status = 'CLOSED';
      batch.closedByAdmin = true;
      batch.closedAt = new Date().toISOString();
      batch.closeReason = 'Ditutup melalui aksi tutup semua PO.';
      count += 1;
    }
  });
  addLog(state, 'CLOSE_ALL_BATCHES', `${count} batch ditutup oleh admin.`, 'admin');
  return count;
}

function validateMenuPayload(payload, partial = false) {
  const result = {};
  if (!partial || payload.name !== undefined) result.name = cleanText(payload.name, 'Nama menu', { required: true, min: 3, max: 100 });
  if (!partial || payload.category !== undefined) result.category = cleanText(payload.category, 'Kategori', { required: true, min: 2, max: 60 });
  if (!partial || payload.price !== undefined) result.price = nonNegativeNumber(payload.price, 'Harga');
  if (!partial || payload.unit !== undefined) result.unit = cleanText(payload.unit, 'Satuan', { required: true, min: 1, max: 40 });
  if (!partial || payload.openerMin !== undefined) result.openerMin = positiveInteger(payload.openerMin, 'Minimum pembuka', { min: 1, max: 10000 });
  if (!partial || payload.defaultCapacity !== undefined || payload.capacity !== undefined) result.defaultCapacity = positiveInteger(payload.defaultCapacity ?? payload.capacity, 'Kapasitas', { min: 1, max: 100000 });
  if (!partial || payload.description !== undefined) result.description = cleanText(payload.description, 'Deskripsi', { required: true, min: 5, max: 700 });
  if (payload.image !== undefined) result.image = cleanText(payload.image, 'Foto', { max: 300 });
  if (payload.imageAlt !== undefined) result.imageAlt = cleanText(payload.imageAlt, 'Teks alternatif', { max: 180 });
  if (payload.active !== undefined) result.active = Boolean(payload.active);
  if (payload.sortOrder !== undefined) result.sortOrder = positiveInteger(payload.sortOrder, 'Urutan menu', { min: 1, max: 10000 });
  return result;
}

function deleteMenu(state, menuId) {
  const menu = state.menus.find((item) => item.id === menuId);
  if (!menu) throw new Error('Menu tidak ditemukan.');
  const hasOrderLinks = state.orders.some((order) => order.items.some((item) => item.menuId === menuId));
  const hasActiveBatches = state.batches.some((batch) => batch.menuId === menuId && ['WAITING_OPENER', 'OPEN', 'CLOSING_SOON', 'OPENER_PENDING_PAYMENT', 'SCHEDULED', 'DRAFT'].includes(batch.status));
  if (hasOrderLinks || hasActiveBatches) {
    menu.active = false;
    addLog(state, 'DISABLE_MENU', `${menu.name} dinonaktifkan karena masih memiliki keterkaitan pesanan atau batch.`, 'admin');
    return menu;
  }
  state.menus = state.menus.filter((item) => item.id !== menuId);
  state.batches = state.batches.filter((batch) => batch.menuId !== menuId);
  addLog(state, 'DELETE_MENU', `${menu.name} dihapus dari katalog.`, 'admin');
  return menu || null;
}

function updateMenu(state, menuId, patch) {
  const menu = state.menus.find((item) => item.id === menuId);
  if (!menu) throw new Error('Menu tidak ditemukan.');
  const next = validateMenuPayload(patch, true);
  if (next.defaultCapacity !== undefined) {
    const affected = state.batches.filter((batch) => batch.menuId === menuId);
    affected.forEach((batch) => {
      const minCapacity = Number(batch.soldQty || 0) + Number(batch.heldQty || 0);
      if (next.defaultCapacity < minCapacity) throw new Error(`Kapasitas minimal ${minCapacity} karena terdapat kuota terjual atau tertahan.`);
    });
  }
  Object.assign(menu, next);
  state.batches.filter((batch) => batch.menuId === menuId).forEach((batch) => {
    if (next.price !== undefined) batch.price = next.price;
    if (next.openerMin !== undefined) batch.openerMin = next.openerMin;
    if (next.defaultCapacity !== undefined && batch.soldQty === 0) batch.capacity = next.defaultCapacity;
  });
  addLog(state, 'UPDATE_MENU', `${menu.name} diperbarui.`, 'admin');
  return menu;
}

function addMenu(state, payload) {
  const clean = validateMenuPayload(payload, false);
  const menu = { id: uid('menu'), sortOrder: clean.sortOrder || state.menus.length + 1, ...clean, regularMin: 1, icon: cleanText(payload.icon || '🍽️', 'Ikon', { max: 8 }), image: clean.image || 'assets/images/jajan-pasar.webp', imageAlt: clean.imageAlt || `${clean.name}`, featured: false, active: true, isDemo: true };
  state.menus.push(menu);
  addLog(state, 'ADD_MENU', `${menu.name} ditambahkan.`, 'admin');
  return menu;
}

function addBatch(state, payload) {
  const menuId = cleanText(payload.menuId, 'Menu', { required: true, max: 80 });
  const menu = state.menus.find((item) => item.id === menuId);
  if (!menu) throw new Error('Menu tidak ditemukan.');
  const batch = {
    id: uid('batch'), menuId, status: BATCH_STATUSES.has(payload.status) ? payload.status : 'DRAFT', soldQty: 0, heldQty: 0,
    capacity: positiveInteger(payload.capacity ?? menu.defaultCapacity, 'Kapasitas', { min: 1, max: 100000 }),
    openerMin: positiveInteger(payload.openerMin ?? menu.openerMin, 'Minimum pembuka', { min: 1, max: 10000 }), regularMin: 1,
    price: nonNegativeNumber(payload.price ?? menu.price, 'Harga batch'), opensAt: validIso(payload.opensAt || new Date().toISOString(), 'Waktu buka'),
    closesAt: validIso(payload.closesAt, 'Waktu tutup'), deliveryAt: validIso(payload.deliveryAt, 'Waktu pengiriman'),
    deliveryEndAt: validIso(payload.deliveryEndAt || new Date(new Date(payload.deliveryAt).getTime() + 4 * 3600000).toISOString(), 'Batas akhir pengiriman'),
    openerOrderId: null, closedByAdmin: false, isDemo: true
  };
  if (new Date(batch.closesAt) >= new Date(batch.deliveryAt)) throw new Error('Waktu tutup harus sebelum waktu pengiriman.');
  state.batches.push(batch);
  addLog(state, 'ADD_BATCH', `Batch baru untuk ${menu.name} ditambahkan.`, 'admin');
  return batch;
}

function updateSettings(state, patch) {
  const allowedText = ['businessName', 'phone', 'whatsappGreeting', 'tagline', 'location', 'operationHours', 'bankAccount'];
  const next = {};
  allowedText.forEach((key) => { if (patch[key] !== undefined) next[key] = cleanText(patch[key], key, { required: key !== 'whatsappGreeting', max: key === 'whatsappGreeting' ? 500 : 180 }); });
  if (patch.whatsappNumber !== undefined) next.whatsappNumber = normalizeWhatsApp(patch.whatsappNumber);
  if (patch.themeDefault !== undefined) {
    if (!['light', 'dark'].includes(patch.themeDefault)) throw new Error('Tema tidak valid.');
    next.themeDefault = patch.themeDefault;
  }
  if (patch.paymentTimeoutMinutes !== undefined) next.paymentTimeoutMinutes = positiveInteger(patch.paymentTimeoutMinutes, 'Batas pembayaran', { min: 5, max: 1440 });
  if (patch.expiryWarningMinutes !== undefined) next.expiryWarningMinutes = positiveInteger(patch.expiryWarningMinutes, 'Peringatan kedaluwarsa', { min: 1, max: 720 });
  if (next.paymentTimeoutMinutes && next.expiryWarningMinutes && next.expiryWarningMinutes >= next.paymentTimeoutMinutes) throw new Error('Peringatan harus lebih pendek daripada batas pembayaran.');
  if (patch.autoCancelUnverified !== undefined) next.autoCancelUnverified = Boolean(patch.autoCancelUnverified);
  if (patch.notificationSound !== undefined) next.notificationSound = Boolean(patch.notificationSound);
  if (patch.bankAccount !== undefined) next.bankAccount = cleanText(patch.bankAccount, 'Rekening pembayaran', { max: 220 });
  if (patch.qrisImage !== undefined) next.qrisImage = cleanText(patch.qrisImage, 'Gambar QRIS', { max: 400 });
  if (patch.cashPickupEnabled !== undefined) next.cashPickupEnabled = Boolean(patch.cashPickupEnabled);
  Object.assign(state.settings, next);
  addLog(state, 'UPDATE_SETTINGS', 'Pengaturan usaha diperbarui.', 'admin');
  return state.settings;
}

function markNotificationRead(state, notificationId) {
  const item = state.notifications.find((entry) => entry.id === notificationId);
  if (item) item.read = true;
  return item || null;
}

function markAllNotificationsRead(state) {
  state.notifications.forEach((item) => { item.read = true; });
  return state.notifications.length;
}

function addTestimonial(state, payload) {
  const item = { id: uid('testimonial'), name: cleanText(payload.name || '', 'Nama', { max: 80 }) || 'Testimoni WhatsApp', menuName: cleanText(payload.menuName || '', 'Nama menu', { max: 100 }), image: cleanText(payload.image || 'assets/images/testimoni.webp', 'Gambar', { required: true, max: 400 }), caption: cleanText(payload.caption || '', 'Caption', { max: 300 }), active: payload.active !== false, sortOrder: payload.sortOrder === undefined ? state.testimonials.length + 1 : positiveInteger(payload.sortOrder, 'Urutan testimoni', { min: 1, max: 10000 }), isDemo: true };
  state.testimonials.push(item);
  addLog(state, 'ADD_TESTIMONIAL', `Testimoni ${item.name} ditambahkan.`, 'admin');
  return item;
}

function updateTestimonial(state, testimonialId, patch) {
  const item = state.testimonials.find((entry) => entry.id === testimonialId);
  if (!item) throw new Error('Testimoni tidak ditemukan.');
  if (patch.name !== undefined) item.name = cleanText(patch.name || '', 'Nama', { max: 80 }) || 'Testimoni WhatsApp';
  if (patch.menuName !== undefined) item.menuName = cleanText(patch.menuName || '', 'Nama menu', { max: 100 });
  if (patch.caption !== undefined) item.caption = cleanText(patch.caption || '', 'Caption', { max: 300 });
  if (patch.image !== undefined) item.image = cleanText(patch.image, 'Gambar', { required: true, max: 400 });
  if (patch.active !== undefined) item.active = Boolean(patch.active);
  if (patch.sortOrder !== undefined) item.sortOrder = positiveInteger(patch.sortOrder, 'Urutan testimoni', { min: 1, max: 10000 });
  addLog(state, 'UPDATE_TESTIMONIAL', `Testimoni ${item.name} diperbarui.`, 'admin');
  return item;
}

function deleteTestimonial(state, testimonialId) {
  const item = state.testimonials.find((entry) => entry.id === testimonialId);
  state.testimonials = state.testimonials.filter((entry) => entry.id !== testimonialId);
  addLog(state, 'DELETE_TESTIMONIAL', `Testimoni ${item?.name || testimonialId} dihapus.`, 'admin');
  return item || null;
}

function assertInvariants(state) {
  const codes = new Set();
  state.orders.forEach((order) => {
    if (codes.has(order.code)) throw new Error(`Invariant gagal: nomor pesanan ganda ${order.code}.`);
    codes.add(order.code);
    if (order.paymentStatus === 'PAID' && order.orderStatus === 'WAITING_PAYMENT') throw new Error(`Invariant gagal: ${order.code} sudah dibayar tetapi masih menunggu pembayaran.`);
    if (order.paymentStatus === 'REFUNDED' && order.refundStatus !== 'REFUNDED') throw new Error(`Invariant gagal: status refund ${order.code} tidak konsisten.`);
  });
  state.batches.forEach((batch) => {
    const sold = Number(batch.soldQty || 0);
    const held = Number(batch.heldQty || 0);
    const capacity = Number(batch.capacity || 0);
    if (sold < 0 || held < 0 || capacity < sold + held) throw new Error(`Invariant gagal pada ${batch.id}: kapasitas tidak mencukupi.`);
    if (!BATCH_STATUSES.has(batch.status)) throw new Error(`Invariant gagal: status batch ${batch.status} tidak dikenal.`);
  });
  return true;
}

module.exports = {
  ensureCollections, processExpiredOrders, availableQty, requiredMin, canPurchase, createOrder, submitPaymentProof, reviewPayment, verifyOrder, confirmRefund, rejectOrExpireOrder,
  extendPaymentDeadline, updateOrderStatus, bulkProductionStatus, updateBatch, closeAllOpenBatches, deleteMenu, updateMenu, addMenu, addBatch,
  updateSettings, markNotificationRead, markAllNotificationsRead, addTestimonial, updateTestimonial, deleteTestimonial,
  assertInvariants, deepClone, normalizePhone
};
