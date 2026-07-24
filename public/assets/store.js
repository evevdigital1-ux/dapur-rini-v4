(function () {
  'use strict';

  const CART_KEY = 'dapurRiniCartV2';
  const THEME_EVENT = 'dapur-rini-state-changed';
  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  let state = window.DAPUR_RINI_CREATE_SEED(new Date());
  let cart = loadCart();
  let authenticated = false;
  let csrfToken = '';
  let refreshPromise = null;

  function loadCart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    dispatchChanged();
  }

  function dispatchChanged() {
    window.dispatchEvent(new CustomEvent(THEME_EVENT));
  }

  function mergeState(next) {
    state = next || state;
    state.settings ||= {};
    state.menus ||= [];
    state.batches ||= [];
    state.orders ||= [];
    state.notifications ||= [];
    state.activityLogs ||= [];
    state.testimonials ||= [];
    state.cart = deepClone(cart);
    return state;
  }

  async function request(path, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (csrfToken && options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    let payload;
    try { payload = await response.json(); }
    catch (_) { payload = { error: `Server mengembalikan respons ${response.status}.` }; }
    if (!response.ok || payload.ok === false) {
      if (response.status === 401) {
        authenticated = false;
        csrfToken = '';
      }
      throw new Error(payload.error || 'Permintaan gagal.');
    }
    return payload;
  }

  async function init() {
    const session = await request('/api/session');
    authenticated = Boolean(session.authenticated);
    csrfToken = session.csrfToken || '';
    await refresh();
    return getState();
  }

  async function refresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = request('/api/state')
      .then((payload) => {
        authenticated = Boolean(payload.authenticated);
        if (!authenticated) csrfToken = '';
        return mergeState(payload.state);
      })
      .finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  function getState() {
    state.cart = deepClone(cart);
    return state;
  }

  function availableQty(batch) {
    return Math.max(0, Number(batch?.capacity || 0) - Number(batch?.soldQty || 0) - Number(batch?.heldQty || 0));
  }

  function requiredMin(batch) {
    return batch?.status === 'WAITING_OPENER' ? Number(batch.openerMin || 1) : Number(batch?.regularMin || 1);
  }

  function canPurchase(batch) {
    return Boolean(batch) && ['WAITING_OPENER', 'OPEN', 'CLOSING_SOON'].includes(batch.status) && !batch.closedByAdmin && new Date(batch.closesAt).getTime() > Date.now() && availableQty(batch) >= requiredMin(batch);
  }

  function batchPriority(batch) {
    const statusPriority = { OPEN: 0, CLOSING_SOON: 1, WAITING_OPENER: 2, OPENER_PENDING_PAYMENT: 3, SCHEDULED: 4, DRAFT: 5, SOLD_OUT: 6, CLOSED: 7, CANCELLED: 8, COMPLETED: 9 };
    return [statusPriority[batch.status] ?? 10, new Date(batch.deliveryAt).getTime() || Number.MAX_SAFE_INTEGER];
  }

  function selectBatchForMenu(menuId) {
    const batches = state.batches.filter((batch) => batch.menuId === menuId).sort((a, b) => {
      const pa = batchPriority(a); const pb = batchPriority(b);
      return pa[0] - pb[0] || pa[1] - pb[1];
    });
    return batches.find(canPurchase) || batches[0] || null;
  }

  function addToCart(menuId, qty) {
    qty = Number(qty);
    const menu = state.menus.find((item) => item.id === menuId && item.active);
    const batch = selectBatchForMenu(menuId);
    if (!menu || !batch) throw new Error('Menu atau batch tidak ditemukan.');
    if (!canPurchase(batch)) throw new Error('Menu ini belum dapat dipesan.');
    const minimum = requiredMin(batch);
    if (!Number.isInteger(qty) || qty < minimum) throw new Error(`Jumlah minimum adalah ${minimum} ${menu.unit}.`);
    const existing = cart.find((item) => item.batchId === batch.id);
    const currentQty = existing ? existing.qty : 0;
    if (qty + currentQty > availableQty(batch)) throw new Error(`Sisa kuota hanya ${availableQty(batch)} ${menu.unit}.`);
    if (cart.length) {
      const firstBatch = state.batches.find((item) => item.id === cart[0].batchId);
      if (firstBatch && String(firstBatch.deliveryAt).slice(0, 10) !== String(batch.deliveryAt).slice(0, 10)) throw new Error('Satu checkout hanya dapat berisi menu dengan tanggal pengiriman yang sama.');
    }
    if (batch.status === 'WAITING_OPENER' && cart.length && !existing) throw new Error('Pesanan pembuka harus dibuat dalam checkout tersendiri.');
    if (existing) existing.qty += qty;
    else cart.push({ menuId, batchId: batch.id, qty, isOpener: batch.status === 'WAITING_OPENER' });
    saveCart();
  }

  function setCartQty(batchId, qty) {
    qty = Number(qty);
    const item = cart.find((entry) => entry.batchId === batchId);
    const batch = state.batches.find((entry) => entry.id === batchId);
    const menu = state.menus.find((entry) => entry.id === batch?.menuId);
    if (!item || !batch || !menu) return;
    const minimum = requiredMin(batch);
    if (qty <= 0) {
      cart = cart.filter((entry) => entry.batchId !== batchId);
      saveCart();
      return;
    }
    if (!Number.isInteger(qty) || qty < minimum) throw new Error(`Jumlah minimum adalah ${minimum} ${menu.unit}.`);
    if (qty > availableQty(batch)) throw new Error(`Sisa kuota hanya ${availableQty(batch)} ${menu.unit}.`);
    item.qty = qty;
    saveCart();
  }

  function clearCart() {
    cart = [];
    saveCart();
  }

  async function command(commandName, payload = {}) {
    const response = await request('/api/command', { method: 'POST', body: { command: commandName, payload } });
    mergeState(response.state);
    dispatchChanged();
    return response.result;
  }

  async function checkout(payload) {
    const result = await command('createOrder', { ...payload, cart: deepClone(cart) });
    cart = [];
    localStorage.removeItem(CART_KEY);
    state.lastOrderCode = result.code;
    state.lastOrderPhone = result.phone;
    dispatchChanged();
    return result;
  }

  const reviewPayment = (orderId, decision, payload = {}) => command('reviewPayment', { orderId, decision, ...payload });
  const verifyOrder = (orderId) => reviewPayment(orderId, 'RECEIVE');
  const confirmRefund = (orderId, payload = {}) => command('confirmRefund', { orderId, ...payload });
  const rejectOrExpireOrder = (orderId, type) => command('rejectOrExpireOrder', { orderId, type });
  const extendPaymentDeadline = (orderId, minutes) => command('extendPaymentDeadline', { orderId, minutes });
  const updateOrderStatus = (orderId, status) => command('updateOrderStatus', { orderId, status });
  const bulkProductionStatus = (status, deliveryDate = '') => command('bulkProductionStatus', { status, deliveryDate });
  const updateBatch = (batchId, patch) => command('updateBatch', { batchId, patch });
  const closeAllOpenBatches = () => command('closeAllOpenBatches');
  const updateMenu = (menuId, patch) => command('updateMenu', { menuId, patch });
  const addMenu = (payload) => command('addMenu', payload);
  const deleteMenu = (menuId) => command('deleteMenu', { menuId });
  const addBatch = (payload) => command('addBatch', payload);
  const updateSettings = (patch) => command('updateSettings', { patch, qrisImageData: patch.qrisImageData || '' });
  const markNotificationRead = (notificationId) => command('markNotificationRead', { notificationId });
  const markAllNotificationsRead = () => command('markAllNotificationsRead');
  const addTestimonial = (payload) => command('addTestimonial', payload);
  const updateTestimonial = (testimonialId, patch) => command('updateTestimonial', { testimonialId, patch, imageData: patch.imageData || '' });
  const deleteTestimonial = (testimonialId) => command('deleteTestimonial', { testimonialId });
  const processExpiredOrders = () => refresh();

  async function reset() {
    const response = await request('/api/reset', { method: 'POST', body: {} });
    cart = [];
    localStorage.removeItem(CART_KEY);
    mergeState(response.state);
    dispatchChanged();
    return response.result;
  }

  async function login(username, password, devicePin = '') {
    try {
      const response = await request('/api/login', { method: 'POST', body: { username, password, devicePin } });
      authenticated = true;
      csrfToken = response.csrfToken || '';
      await refresh();
      dispatchChanged();
      return true;
    } catch (error) {
      if (/Username atau password/.test(error.message)) return false;
      throw error;
    }
  }

  async function logout() {
    if (authenticated) await request('/api/logout', { method: 'POST', body: {} });
    authenticated = false;
    csrfToken = '';
    await refresh();
    dispatchChanged();
  }

  function isLoggedIn() { return authenticated; }

  async function trackOrder(code, phone) {
    const params = new URLSearchParams({ code: String(code || '').trim(), phone: String(phone || '').trim() });
    const response = await request(`/api/track?${params.toString()}`);
    return response.order;
  }

  async function submitPaymentProof(payload) {
    const response = await request('/api/payment-proof', { method: 'POST', body: payload });
    return response.order;
  }

  window.addEventListener('storage', (event) => {
    if (event.key === CART_KEY) {
      cart = loadCart();
      dispatchChanged();
    }
  });

  window.DapurRiniStore = {
    init, refresh, getState, availableQty, requiredMin, canPurchase, selectBatchForMenu,
    addToCart, setCartQty, clearCart, checkout, submitPaymentProof, reviewPayment, verifyOrder, confirmRefund, rejectOrExpireOrder,
    extendPaymentDeadline, updateOrderStatus, bulkProductionStatus, updateBatch, closeAllOpenBatches,
    updateMenu, addMenu, deleteMenu, addBatch, updateSettings, markNotificationRead, markAllNotificationsRead,
    addTestimonial, updateTestimonial, deleteTestimonial, processExpiredOrders, reset,
    login, logout, isLoggedIn, trackOrder
  };
})();
