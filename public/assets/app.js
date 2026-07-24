(function () {
  'use strict';

  const Store = window.DapurRiniStore;
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');
  const isAdminRoute = new URLSearchParams(location.search).get('view') === 'admin';
  let activeCategory = 'Semua';
  let activeStatus = 'ALL';
  let searchTerm = '';
  let previousModalFocus = null;
  let activeAdminPage = 'dashboard';
  let countdownTimer = null;
  let expiryTimer = null;
  let previousUnreadCount = null;
  let handledInitialHash = false;
  const THEME_KEY = 'dapurRiniThemeV1';
  const adminFilters = {
    batches: { search: '', status: 'ALL' },
    orders: { search: '', payment: 'ALL', status: 'ALL' },
    production: { search: '', status: 'ALL' },
    delivery: { search: '', method: 'ALL', status: 'ALL' },
    payments: { search: '', status: 'TO_CHECK' }
  };

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
  const dateTime = (value) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
  const dateOnly = (value) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(value));
  const jakartaDateKey = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value));
  const timeOnly = (value) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value)).replace('.', ':');
  const toJakartaLocalInput = (iso) => {
    const date = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 16);
  };
  const fromJakartaLocalInput = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!match) throw new Error('Tanggal dan waktu tidak valid.');
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]) - 7, Number(match[5]))).toISOString();
  };
  const menuImage = (menu) => menu?.image || 'assets/images/jajan-pasar.webp';
  const itemImage = (item, state) => item?.image || menuImage(state?.menus?.find((menu) => menu.id === item?.menuId));
  const textMatches = (value, term) => String(value || '').toLowerCase().includes(String(term || '').trim().toLowerCase());
  const paymentRemainingText = (deadline) => {
    if (!deadline) return 'Sudah diverifikasi';
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return 'Kedaluwarsa';
    const hour = Math.floor(diff / 3600000);
    const minute = Math.floor((diff % 3600000) / 60000);
    const second = Math.floor((diff % 60000) / 1000);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  };

  function currentTheme() {
    return localStorage.getItem(THEME_KEY) || Store.getState().settings.themeDefault || 'light';
  }

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#111315' : '#f7f7f5');
  }

  function toggleTheme() {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    if (isAdminRoute) renderAdmin(); else renderCustomer();
  }

  function normalizedWhatsApp(state) {
    let number = String(state.settings.whatsappNumber || state.settings.phone || '').replace(/\D/g, '');
    if (number.startsWith('0')) number = `62${number.slice(1)}`;
    return number;
  }

  function waLink(state, message) {
    return `https://wa.me/${normalizedWhatsApp(state)}?text=${encodeURIComponent(message)}`;
  }

  function waCustomerLink(phone, message) {
    let number = String(phone || '').replace(/\D/g, '');
    if (number.startsWith('0')) number = `62${number.slice(1)}`;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function notificationIcon(type) {
    if (type === 'NEW_ORDER') return '🧾';
    if (type === 'EXPIRING_SOON') return '⏳';
    if (type === 'ORDER_EXPIRED') return '⌛';
    if (type === 'PAYMENT_VERIFIED') return '✓';
    if (['MANUAL_WHATSAPP', 'WHATSAPP_SIMULATION'].includes(type)) return 'WA';
    return '•';
  }

  function playNotificationTone() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 740;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.18);
    } catch (_) {}
  }

  applyTheme(localStorage.getItem(THEME_KEY) || 'light');


  const batchLabel = {
    DRAFT: ['Draft', 'badge-draft'], SCHEDULED: ['Dijadwalkan', 'badge-draft'],
    WAITING_OPENER: ['Butuh pemesan pertama', 'badge-wait'],
    OPENER_PENDING_PAYMENT: ['Menunggu pembayaran pembuka', 'badge-pending'],
    OPEN: ['PO aktif', 'badge-open'], CLOSING_SOON: ['Segera ditutup', 'badge-closing'],
    SOLD_OUT: ['Kuota habis', 'badge-sold'], CLOSED: ['PO ditutup', 'badge-closed'],
    CANCELLED: ['Dibatalkan', 'badge-closed'], IN_PRODUCTION: ['Sedang diproduksi', 'badge-draft'],
    READY: ['Siap diterima', 'badge-open'], COMPLETED: ['Selesai', 'badge-open']
  };

  const paymentLabel = {
    UNPAID: 'Menunggu pembayaran', CASH_DUE: 'Bayar saat pickup', PROOF_UPLOADED: 'Bukti diunggah', PENDING_REVIEW: 'Perlu dicek',
    CHECK_LATER: 'Cek lagi', NEED_NEW_PROOF: 'Minta bukti baru', LATE_PAYMENT_REVIEW: 'Pembayaran terlambat',
    PAID: 'Pembayaran diterima', REJECTED: 'Tidak diterima', EXPIRED: 'Pesanan kedaluwarsa',
    REFUND_PENDING: 'Perlu dikembalikan', REFUNDED: 'Dana sudah dikembalikan', CANCELLED: 'Dibatalkan'
  };

  const paymentMethodLabel = {
    BANK_TRANSFER: 'Transfer bank', TRANSFER_BCA: 'Transfer bank', QRIS_STATIC: 'QRIS', QRIS: 'QRIS', CASH_PICKUP: 'Tunai saat pickup'
  };

  const orderLabel = {
    WAITING_PAYMENT: 'Menunggu pembayaran', CONFIRMED: 'Dikonfirmasi', IN_PRODUCTION: 'Sedang diproduksi',
    READY_FOR_PICKUP: 'Siap diambil', READY_FOR_DELIVERY: 'Siap dikirim', ON_DELIVERY: 'Dalam pengiriman', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan'
  };

  function toast(message, type = '') {
    toastRoot.innerHTML = `<div class="toast ${esc(type)}">${esc(message)}</div>`;
    setTimeout(() => { toastRoot.innerHTML = ''; }, 3200);
  }

  function connectFormLabels(root) {
    root.querySelectorAll('.field > label').forEach((label, index) => {
      if (label.getAttribute('for') || label.querySelector('input,select,textarea')) return;
      const control = label.parentElement.querySelector('input,select,textarea');
      if (!control) return;
      control.id ||= `modal-field-${Date.now()}-${index}`;
      label.setAttribute('for', control.id);
    });
  }

  function openModal(content, large = false) {
    previousModalFocus = document.activeElement;
    modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal ${large ? 'modal-lg' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${content}</section></div>`;
    const modal = modalRoot.querySelector('.modal');
    const heading = modal.querySelector('h1,h2,h3');
    if (heading) heading.id = 'modal-title';
    connectFormLabels(modal);
    modalRoot.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) closeModal();
    });
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    requestAnimationFrame(() => modal.querySelector('[autofocus],input,select,textarea,button,a[href]')?.focus());
  }

  function closeModal() {
    modalRoot.innerHTML = '';
    if (previousModalFocus && typeof previousModalFocus.focus === 'function') previousModalFocus.focus();
    previousModalFocus = null;
  }
  window.closeDapurRiniModal = closeModal;

  function header(state) {
    const cartCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
    return `
      <div class="demo-ribbon">${state.settings.operationMode === 'PRODUCTION' ? 'Pemesanan Dapur Rini' : 'Mode Uji Coba • Gunakan data contoh'}</div>
      <header class="site-header">
        <div class="header-inner">
          <a class="brand" href="index.html">
            <span class="brand-mark">DR</span>
            <span class="brand-copy">Dapur Rini<small>Tegal Alur, Jakarta Barat</small></span>
          </a>
          <div class="header-actions">
            <button class="btn btn-ghost desktop-only" data-action="track-order">Lacak pesanan</button>
            <button class="icon-btn theme-toggle" data-action="toggle-theme" aria-label="Ganti tema">${currentTheme() === 'dark' ? '☀' : '☾'}</button>
            <a class="btn btn-secondary admin-link" href="index.html?view=admin">Admin</a>
            <button class="icon-btn" data-action="open-cart" aria-label="Buka keranjang">🛒 <span class="cart-count">${cartCount}</span></button>
          </div>
        </div>
      </header>`;
  }

  function countdownText(closesAt) {
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return 'Sudah ditutup';
    const hour = Math.floor(diff / 3600000);
    const minute = Math.floor((diff % 3600000) / 60000);
    const second = Math.floor((diff % 60000) / 1000);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  }

  function productCard(menu, batch) {
    const [label, badgeClass] = batchLabel[batch.status] || [batch.status, 'badge-draft'];
    const available = Store.availableQty(batch);
    const soldPct = Math.min(100, Math.round(((batch.soldQty + batch.heldQty) / batch.capacity) * 100));
    const purchasable = Store.canPurchase(batch);
    const min = Store.requiredMin(batch);
    let cta = 'Lihat detail';
    if (batch.status === 'WAITING_OPENER') cta = `Buka PO • Min. ${batch.openerMin}`;
    else if (['OPEN', 'CLOSING_SOON'].includes(batch.status)) cta = 'Pesan sekarang';
    else if (batch.status === 'OPENER_PENDING_PAYMENT') cta = 'Sedang dikunci';
    else if (batch.status === 'SOLD_OUT') cta = 'Kuota habis';
    else if (batch.status === 'CLOSED') cta = 'PO ditutup';

    return `
      <article class="product-card" id="menu-card-${esc(menu.id)}" data-menu-card="${esc(menu.id)}">
        <button class="product-visual product-photo-button" data-action="product-detail" data-menu-id="${esc(menu.id)}" aria-label="Lihat ${esc(menu.name)}">
          <img src="${esc(menuImage(menu))}" alt="${esc(menu.imageAlt || `Foto ${menu.name}`)}" loading="lazy">
          <span class="product-photo-shade"></span>
          <span class="product-badge badge ${badgeClass}">${label}</span>
        </button>
        <div class="product-body">
          <div class="product-title-row">
            <div>
              <span class="product-category">${esc(menu.category)}</span>
              <h3>${esc(menu.name)}</h3>
            </div>
            <div class="price mobile-price">${rupiah(batch.price)}<small>/${esc(menu.unit)}</small></div>
          </div>
          <p>${esc(menu.description)}</p>
          <div class="price-row">
            <div class="price desktop-price">${rupiah(batch.price)}<small>per ${esc(menu.unit)}</small></div>
            <div class="quota"><strong>${available}</strong> tersisa dari ${batch.capacity}</div>
          </div>
          <div class="progress" aria-label="Kuota terisi ${soldPct} persen"><span style="width:${soldPct}%"></span></div>
          <div class="product-meta">
            <div><span>Pengiriman</span><strong>${dateOnly(batch.deliveryAt)}</strong></div>
            <div><span>Tutup dalam</span><strong data-countdown="${esc(batch.closesAt)}">${countdownText(batch.closesAt)}</strong></div>
            <div><span>Minimum</span><strong>${min} ${esc(menu.unit)}</strong></div>
          </div>
          <div class="product-actions">
            <button class="btn btn-ghost" data-action="product-detail" data-menu-id="${esc(menu.id)}">Detail</button>
            <button class="btn btn-primary" data-action="quick-order" data-menu-id="${esc(menu.id)}" ${purchasable ? '' : 'disabled'}>${cta}</button>
          </div>
        </div>
      </article>`;
  }

  function heroShowcase(state) {
    const readyProducts = state.menus
      .filter((menu) => menu.active)
      .map((menu) => ({ menu, batch: Store.selectBatchForMenu(menu.id) }))
      .filter(({ batch }) => batch && ['OPEN', 'CLOSING_SOON'].includes(batch.status) && batch.soldQty >= batch.openerMin)
      .sort((a, b) => b.batch.soldQty - a.batch.soldQty)
      .slice(0, 3);

    if (!readyProducts.length) {
      return `<div class="hero-showcase-empty"><strong>Belum ada PO satuan yang aktif.</strong><span>Pilih menu di katalog untuk menjadi pemesan pembuka.</span></div>`;
    }

    return `
      <div class="hero-showcase">
        <div class="hero-showcase-head">
          <div><span class="hero-kicker">Sudah memenuhi minimum</span><strong>Bisa dipesan mulai 1 porsi</strong></div>
          <span class="hero-swipe">Geser foto →</span>
        </div>
        <div class="hero-product-rail">
          ${readyProducts.map(({ menu, batch }, index) => `
            <button class="hero-product ${index === 0 ? 'hero-product-main' : ''}" data-action="go-to-menu" data-menu-id="${esc(menu.id)}" aria-label="Buka menu ${esc(menu.name)}">
              <img src="${esc(menuImage(menu))}" alt="${esc(menu.imageAlt || `Foto ${menu.name}`)}">
              <span class="hero-product-overlay"></span>
              <span class="hero-product-status">${batch.status === 'CLOSING_SOON' ? 'Segera tutup' : 'PO aktif'}</span>
              <span class="hero-product-copy">
                <strong>${esc(menu.name)}</strong>
                <small>${rupiah(batch.price)} / ${esc(menu.unit)} • ${batch.soldQty} terpesan</small>
              </span>
            </button>`).join('')}
        </div>
        <p class="hero-showcase-note">Ketuk foto untuk langsung menuju menu yang dipilih.</p>
      </div>`;
  }

  function testimonialSection(state) {
    const testimonials = [...(state.testimonials || [])]
      .filter((item) => item.active)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    return `
      <section class="section testimonial-section" id="testimoni">
        <div class="container">
          <div class="section-head testimonial-heading">
            <div><span class="eyebrow">Kata pelanggan</span><h2>Cerita setelah mencicipi Dapur Rini</h2><p>Testimoni ditampilkan setelah mendapat izin. Nomor dan identitas pelanggan disamarkan.</p></div>
            <span class="testimonial-swipe">Geser untuk melihat lainnya →</span>
          </div>
          <div class="testimonial-rail">
            ${testimonials.length ? testimonials.map((item) => `
              <button class="testimonial-card" data-action="view-testimonial" data-testimonial-id="${esc(item.id)}" aria-label="Buka screenshot testimoni">
                <span class="testimonial-image-wrap"><img src="${esc(item.image)}" alt="Screenshot WhatsApp testimoni" loading="lazy"></span>
              </button>`).join('') : '<div class="empty-state"><strong>Belum ada testimoni aktif</strong></div>'}
          </div>
        </div>
      </section>`;
  }

  function renderCustomer() {
    const state = Store.getState();
    const categories = ['Semua', ...new Set(state.menus.filter((menu) => menu.active).map((menu) => menu.category))];
    const menus = state.menus.filter((menu) => {
      const batch = Store.selectBatchForMenu(menu.id);
      const categoryOk = activeCategory === 'Semua' || menu.category === activeCategory;
      const statusOk = activeStatus === 'ALL' || batch?.status === activeStatus;
      const text = `${menu.name} ${menu.category} ${menu.description}`.toLowerCase();
      return menu.active && batch && categoryOk && statusOk && text.includes(searchTerm.toLowerCase());
    });

    app.innerHTML = `
      ${header(state)}
      <main>
        <section class="hero" id="beranda">
          <div class="container hero-grid">
            <div class="hero-copy">
              <span class="eyebrow">Dapur rumahan • Tegal Alur</span>
              <h1>Pesan hari ini, dimasak segar untuk besok.</h1>
              <p>Pilih paket nasi, donat, atau jajanan pasar. Beberapa menu memerlukan pemesan pembuka; setelah minimum terpenuhi dan dibayar, pelanggan lain dapat membeli satuan.</p>
              <div class="hero-actions">
                <button class="btn btn-primary" data-action="scroll-menu">Lihat menu hari ini</button>
                <button class="btn btn-ghost" data-action="show-how">Cara kerja PO</button>
              </div>
              <div class="hero-trust">
                <span><b>18.00</b><small>Batas PO default</small></span>
                <span><b>Besok</b><small>Jadwal produksi</small></span>
                <span><b>2 cara</b><small>Ambil / dikirim</small></span>
              </div>
            </div>
            ${heroShowcase(state)}
          </div>
        </section>

        <section class="section-tight po-guide-section">
          <div class="container info-strip" id="cara-kerja">
            <div class="info-item"><span class="info-number">1</span><div><strong>Pilih menu</strong><span>Periksa status, jumlah minimum, waktu tutup, dan sisa kuota.</span></div></div>
            <div class="info-item"><span class="info-number">2</span><div><strong>Bayar dan verifikasi</strong><span>Dalam demo, admin memeriksa bukti pembayaran sebelum pesanan diproses.</span></div></div>
            <div class="info-item"><span class="info-number">3</span><div><strong>Terima keesokan hari</strong><span>Ambil di Tegal Alur atau pilih pengiriman sesuai area layanan.</span></div></div>
          </div>
        </section>

        <section class="section catalog-section" id="menu">
          <div class="container">
            <div class="section-head">
              <div><span class="eyebrow">Menu pre-order</span><h2>Mau makan apa besok?</h2><p>Pilih menu yang PO-nya sudah aktif atau jadilah pemesan pembuka sesuai jumlah minimum.</p></div>
              <button class="btn btn-ghost desktop-track" data-action="track-order">Lacak pesanan</button>
            </div>
            <div class="catalog-tools">
              <div class="search-box"><input id="menu-search" type="search" placeholder="Cari ayam, donat, kue bugis..." value="${esc(searchTerm)}" autocomplete="off" aria-label="Cari menu"></div>
              <div class="status-filter"><label for="menu-status">Status PO</label><select id="menu-status"><option value="ALL" ${activeStatus === 'ALL' ? 'selected' : ''}>Semua status</option><option value="WAITING_OPENER" ${activeStatus === 'WAITING_OPENER' ? 'selected' : ''}>Butuh pembuka</option><option value="OPEN" ${activeStatus === 'OPEN' ? 'selected' : ''}>PO aktif</option><option value="CLOSING_SOON" ${activeStatus === 'CLOSING_SOON' ? 'selected' : ''}>Segera ditutup</option><option value="OPENER_PENDING_PAYMENT" ${activeStatus === 'OPENER_PENDING_PAYMENT' ? 'selected' : ''}>Menunggu pembayaran</option><option value="SOLD_OUT" ${activeStatus === 'SOLD_OUT' ? 'selected' : ''}>Kuota habis</option><option value="CLOSED" ${activeStatus === 'CLOSED' ? 'selected' : ''}>Ditutup</option></select></div>
            </div>
            <div class="chips">${categories.map((category) => `<button class="chip ${category === activeCategory ? 'active' : ''}" data-action="filter-category" data-category="${esc(category)}">${esc(category)}</button>`).join('')}</div>
            <div class="catalog-result">${menus.length} menu ditemukan</div>
            <div class="product-grid">${menus.length ? menus.map((menu) => productCard(menu, Store.selectBatchForMenu(menu.id))).join('') : '<div class="empty-state"><div class="emoji">🔎</div><strong>Menu tidak ditemukan</strong><p>Coba kata kunci atau kategori lain.</p></div>'}</div>
          </div>
        </section>

        ${testimonialSection(state)}

        <section class="section faq-section">
          <div class="container">
            <div class="section-head"><div><span class="eyebrow">Pertanyaan umum</span><h2>Sebelum melakukan pemesanan</h2></div></div>
            <div class="faq-grid">
              <details><summary>Mengapa beberapa menu belum bisa dibeli satuan?</summary><p>Menu tersebut belum mencapai minimum produksi. Pemesan pertama harus memesan sekurang-kurangnya jumlah pembuka yang tertera.</p></details>
              <details><summary>Kapan menu mulai bisa dibeli per porsi?</summary><p>Setelah pembayaran pemesan pembuka diverifikasi, status berubah menjadi PO aktif dan pembeli berikutnya dapat memesan mulai satu porsi.</p></details>
              <details><summary>Bagaimana proses pengiriman?</summary><p>Dapur Rini mengatur pengiriman secara manual. Ongkir dan waktu pengantaran dikonfirmasi melalui WhatsApp.</p></details>
              <details><summary>Apakah pembayaran pada website ini nyata?</summary><p>Tidak. Rekening, QRIS, bukti pembayaran, pelanggan, dan seluruh transaksi masih menggunakan data demonstrasi.</p></details>
            </div>
          </div>
        </section>
      </main>
      <footer class="footer"><div class="container footer-grid"><div><a class="brand" href="#beranda"><span class="brand-mark">DR</span><span class="brand-copy">${esc(state.settings.businessName)}<small>${esc(state.settings.location)}</small></span></a><p style="margin-top:16px">Prototipe sistem pre-order makanan rumahan. Belum menerima transaksi nyata.</p><small>Foto pilihan bersumber dari Wikimedia Commons; rincian terdapat pada ATTRIBUTIONS.md.</small></div><div><strong>Hubungi Dapur Rini</strong><a href="${waLink(state, state.settings.whatsappGreeting)}" target="_blank" rel="noopener">WhatsApp ${esc(state.settings.phone)}</a><a href="#testimoni">Lihat testimoni pelanggan</a><a href="#menu">Pilih menu hari ini</a></div><div><strong>Jam layanan</strong><p>${esc(state.settings.operationHours)}<br>PO default tutup ${esc(state.settings.defaultCutoff)}<br>Pengiriman hari berikutnya.</p></div></div></footer>
      <button class="whatsapp-fab" data-action="open-whatsapp" aria-label="Hubungi Dapur Rini melalui WhatsApp"><span>WA</span><b>Tanya Dapur Rini</b></button>
      ${state.cart.length ? floatingCart(state) : ''}
      <nav class="customer-bottom-nav" aria-label="Navigasi pelanggan">
        <button data-action="go-top"><span>⌂</span>Beranda</button>
        <button data-action="scroll-menu"><span>▦</span>Menu</button>
        <button data-action="open-whatsapp"><span>WA</span>Chat</button>
        <button data-action="track-order"><span>⌕</span>Lacak</button>
        <button data-action="open-cart"><span>🛒</span>Keranjang<em>${state.cart.reduce((sum, item) => sum + item.qty, 0)}</em></button>
      </nav>`;

    bindCustomerEvents();
    startCountdowns();
    if (!handledInitialHash && String(location.hash || '').startsWith('#menu-card-')) {
      handledInitialHash = true;
      requestAnimationFrame(() => {
        const card = document.querySelector(location.hash);
        if (card) {
          card.scrollIntoView({ block: 'center' });
          card.classList.add('product-card-highlight');
          setTimeout(() => card.classList.remove('product-card-highlight'), 1800);
        }
      });
    }
  }

  function floatingCart(state) {
    const qty = state.cart.reduce((sum, item) => sum + item.qty, 0);
    const total = state.cart.reduce((sum, item) => {
      const batch = state.batches.find((b) => b.id === item.batchId);
      return sum + (batch ? batch.price * item.qty : 0);
    }, 0);
    return `<button class="floating-cart" data-action="open-cart"><div>Keranjang • ${qty} item<span>${rupiah(total)} sebelum ongkir</span></div><b>Lihat</b></button>`;
  }

  function bindCustomerEvents() {
    app.querySelectorAll('[data-action]').forEach((el) => el.addEventListener('click', handleCustomerAction));
    const search = document.getElementById('menu-search');
    if (search) search.addEventListener('input', (event) => { searchTerm = event.target.value; const caret = searchTerm.length; renderCustomer(); const next = document.getElementById('menu-search'); if (next) { next.focus(); next.setSelectionRange(caret, caret); } });
    const status = document.getElementById('menu-status');
    if (status) status.addEventListener('change', (event) => { activeStatus = event.target.value; renderCustomer(); document.getElementById('menu')?.scrollIntoView(); });
  }

  function handleCustomerAction(event) {
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (action === 'filter-category') { activeCategory = button.dataset.category; renderCustomer(); document.getElementById('menu')?.scrollIntoView(); }
    if (action === 'product-detail' || action === 'quick-order') showProduct(button.dataset.menuId, action === 'quick-order');
    if (action === 'open-cart') showCart();
    if (action === 'track-order') showTracking();
    if (action === 'toggle-theme') toggleTheme();
    if (action === 'open-whatsapp') showWhatsAppOptions();
    if (action === 'view-testimonial') showTestimonial(button.dataset.testimonialId);
    if (action === 'show-how') document.getElementById('cara-kerja')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (action === 'scroll-menu') document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
    if (action === 'go-top') document.getElementById('beranda')?.scrollIntoView({ behavior: 'smooth' });
    if (action === 'go-to-menu') {
      const menuId = button.dataset.menuId;
      activeCategory = 'Semua';
      activeStatus = 'ALL';
      searchTerm = '';
      renderCustomer();
      requestAnimationFrame(() => {
        const card = document.getElementById(`menu-card-${menuId}`);
        if (card) {
          const root = document.documentElement;
          const previousScrollBehavior = root.style.scrollBehavior;
          root.style.scrollBehavior = 'auto';
          card.scrollIntoView({ block: 'center' });
          root.style.scrollBehavior = previousScrollBehavior;
          card.classList.add('product-card-highlight');
          setTimeout(() => card.classList.remove('product-card-highlight'), 1800);
        }
      });
    }
  }

  function showWhatsAppOptions(context = {}) {
    const state = Store.getState();
    const menu = context.menuId ? state.menus.find((item) => item.id === context.menuId) : null;
    const order = context.orderId ? state.orders.find((item) => item.id === context.orderId) : null;
    const options = [
      ['Tanya menu hari ini', menu ? `Halo Dapur Rini, saya ingin bertanya tentang ${menu.name}.` : 'Halo Dapur Rini, saya ingin bertanya tentang menu yang tersedia hari ini.'],
      ['Konfirmasi pembayaran', order ? `Halo Dapur Rini, saya ingin mengonfirmasi pembayaran pesanan ${order.code} atas nama ${order.customerName}.` : 'Halo Dapur Rini, saya ingin mengonfirmasi pembayaran pesanan saya.'],
      ['Tanya status pesanan', order ? `Halo Dapur Rini, mohon informasi status pesanan ${order.code}.` : 'Halo Dapur Rini, saya ingin menanyakan status pesanan saya.'],
      ['Tanya pengiriman', order ? `Halo Dapur Rini, saya ingin menanyakan pengiriman pesanan ${order.code}.` : 'Halo Dapur Rini, saya ingin bertanya tentang pengambilan atau pengiriman pesanan.']
    ];
    openModal(`
      <div class="modal-header"><div><h2>Hubungi Dapur Rini</h2><div class="help">Pilih tujuan chat. Pesan akan terisi otomatis.</div></div><button class="close-btn" data-modal-close>×</button></div>
      <div class="modal-body"><div class="whatsapp-option-list">${options.map(([label, message]) => `<a class="whatsapp-option" href="${waLink(state, message)}" target="_blank" rel="noopener"><span>WA</span><div><strong>${esc(label)}</strong><small>${esc(message)}</small></div><b>›</b></a>`).join('')}</div><div class="notice info" style="margin-top:14px">Nomor WhatsApp dapat diubah melalui Pengaturan Admin.</div></div>`);
  }

  function showTestimonial(testimonialId) {
    const state = Store.getState();
    const item = state.testimonials.find((entry) => entry.id === testimonialId);
    if (!item) return;
    openModal(`
      <div class="modal-header"><div><h2>Testimoni Pelanggan</h2><div class="help">Screenshot Chat WhatsApp</div></div><button class="close-btn" data-modal-close>×</button></div>
      <div class="modal-body"><div class="testimonial-modal-image"><img src="${esc(item.image)}" alt="Screenshot WhatsApp testimoni"></div><div class="notice" style="margin-top:14px">Nomor telepon, alamat, dan informasi pembayaran telah disamarkan.</div></div>
      <div class="modal-footer"><button class="btn btn-ghost" data-modal-close>Tutup</button><button class="btn btn-whatsapp" id="testimonial-chat">Tanya melalui WhatsApp</button></div>`);
    document.getElementById('testimonial-chat').onclick = () => showWhatsAppOptions();
  }

  function showProduct(menuId, focusOrder = false) {
    const state = Store.getState();
    const menu = state.menus.find((item) => item.id === menuId);
    const batch = Store.selectBatchForMenu(menuId);
    if (!menu || !batch) return;
    const available = Store.availableQty(batch);
    const minimum = Store.requiredMin(batch);
    const canBuy = Store.canPurchase(batch);
    const [label, badgeClass] = batchLabel[batch.status] || [batch.status, 'badge-draft'];
    const guidance = batch.status === 'WAITING_OPENER'
      ? `Menu ini membutuhkan pemesan pertama minimal ${batch.openerMin} ${menu.unit}. Setelah pembayaran diverifikasi, pelanggan berikutnya dapat membeli mulai ${batch.regularMin} ${menu.unit}.`
      : batch.status === 'OPENER_PENDING_PAYMENT'
        ? 'Satu pemesan sudah membuka PO. Pembelian sementara dikunci sampai pembayaran pembuka diverifikasi atau kedaluwarsa.'
        : ['OPEN', 'CLOSING_SOON'].includes(batch.status)
          ? `PO sudah aktif. Anda dapat membeli mulai ${batch.regularMin} ${menu.unit}.`
          : 'Menu ini tidak menerima pesanan baru.';

    openModal(`
      <div class="modal-header"><div><span class="badge ${badgeClass}">${label}</span><h2 style="margin-top:10px">${esc(menu.name)}</h2></div><button class="close-btn" data-modal-close>×</button></div>
      <div class="modal-body">
        <div class="modal-product-photo"><img src="${esc(menuImage(menu))}" alt="${esc(menu.imageAlt || `Foto ${menu.name}`)}"></div>
        <p>${esc(menu.description)}</p>
        <div class="summary-box">
          <div class="summary-row"><span>Harga</span><strong>${rupiah(batch.price)} / ${esc(menu.unit)}</strong></div>
          <div class="summary-row"><span>Pengiriman</span><strong>${dateOnly(batch.deliveryAt)}, ${timeOnly(batch.deliveryAt)}–${timeOnly(batch.deliveryEndAt)}</strong></div>
          <div class="summary-row"><span>Sisa kuota</span><strong>${available} ${esc(menu.unit)}</strong></div>
          <div class="summary-row"><span>PO ditutup</span><strong>${dateTime(batch.closesAt)}</strong></div>
        </div>
        <div class="notice ${canBuy ? 'info' : ''}" style="margin-top:14px">${guidance}</div>
        ${canBuy ? `<div class="modal-qty-row"><div><strong>Jumlah pesanan</strong><div class="help">Minimum ${minimum} ${esc(menu.unit)}</div></div><div class="qty-control"><button data-modal-action="minus">−</button><input id="product-qty" type="number" min="${minimum}" max="${available}" value="${minimum}"><button data-modal-action="plus">+</button></div></div>` : ''}
      </div>
      <div class="modal-footer"><button class="btn btn-whatsapp" id="ask-product-btn">Tanya menu ini</button><button class="btn btn-ghost" data-modal-close>Tutup</button>${canBuy ? `<button class="btn btn-primary" id="add-product-btn">Tambahkan ke keranjang</button>` : ''}</div>`);
    document.getElementById('ask-product-btn').onclick = () => showWhatsAppOptions({ menuId });

    if (canBuy) {
      const input = document.getElementById('product-qty');
      modalRoot.querySelector('[data-modal-action="minus"]').onclick = () => { input.value = Math.max(minimum, Number(input.value || minimum) - 1); };
      modalRoot.querySelector('[data-modal-action="plus"]').onclick = () => { input.value = Math.min(available, Number(input.value || minimum) + 1); };
      document.getElementById('add-product-btn').onclick = () => {
        try {
          Store.addToCart(menuId, Number(input.value));
          closeModal();
          renderCustomer();
          toast(`${menu.name} ditambahkan ke keranjang.`, 'success');
        } catch (error) { toast(error.message, 'error'); }
      };
      if (focusOrder) setTimeout(() => input.focus(), 40);
    }
  }

  function cartDetails(state) {
    let subtotal = 0;
    const html = state.cart.map((item) => {
      const menu = state.menus.find((entry) => entry.id === item.menuId);
      const batch = state.batches.find((entry) => entry.id === item.batchId);
      const line = batch.price * item.qty;
      subtotal += line;
      return `<div class="cart-item"><div class="cart-thumb"><img src="${esc(menuImage(menu))}" alt=""></div><div><h4>${esc(menu.name)}</h4><small>${rupiah(batch.price)} / ${esc(menu.unit)}${item.isOpener ? ' • Pemesan pembuka' : ''}</small></div><div class="cart-line-action"><strong>${rupiah(line)}</strong><div class="qty-control"><button data-cart-minus="${batch.id}">−</button><input data-cart-qty="${batch.id}" type="number" value="${item.qty}"><button data-cart-plus="${batch.id}">+</button></div></div></div>`;
    }).join('');
    return { html, subtotal };
  }

  function showCart() {
    const state = Store.getState();
    if (!state.cart.length) {
      openModal(`<div class="modal-header"><h2>Keranjang</h2><button class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="empty-state"><div class="emoji">🛒</div><strong>Keranjang masih kosong</strong><p>Pilih menu yang tersedia untuk memulai pesanan.</p></div></div>`);
      return;
    }
    const details = cartDetails(state);
    openModal(`
      <div class="modal-header"><div><h2>Keranjang pesanan</h2><div class="help">Periksa jumlah sebelum checkout.</div></div><button class="close-btn" data-modal-close>×</button></div>
      <div class="modal-body"><div class="cart-list">${details.html}</div><div class="summary-box"><div class="summary-row total"><span>Subtotal</span><strong>${rupiah(details.subtotal)}</strong></div></div><div class="notice info" style="margin-top:14px">Perkiraan ongkir Rp18.000 akan ditambahkan saat checkout. Ongkir akhir dapat dikonfirmasi melalui WhatsApp. Ambil sendiri tidak dikenakan ongkir.</div></div>
      <div class="modal-footer"><button class="btn btn-ghost" id="clear-cart">Kosongkan</button><button class="btn btn-primary" id="go-checkout">Lanjut checkout</button></div>`);

    modalRoot.querySelectorAll('[data-cart-minus]').forEach((button) => button.onclick = () => changeCartQty(button.dataset.cartMinus, -1));
    modalRoot.querySelectorAll('[data-cart-plus]').forEach((button) => button.onclick = () => changeCartQty(button.dataset.cartPlus, 1));
    modalRoot.querySelectorAll('[data-cart-qty]').forEach((input) => input.onchange = () => {
      try { Store.setCartQty(input.dataset.cartQty, Number(input.value)); showCart(); renderCustomer(); }
      catch (error) { toast(error.message, 'error'); showCart(); }
    });
    document.getElementById('clear-cart').onclick = () => { Store.clearCart(); closeModal(); renderCustomer(); toast('Keranjang dikosongkan.'); };
    document.getElementById('go-checkout').onclick = showCheckout;
  }

  function changeCartQty(batchId, delta) {
    const state = Store.getState();
    const item = state.cart.find((entry) => entry.batchId === batchId);
    try { Store.setCartQty(batchId, item.qty + delta); showCart(); renderCustomer(); }
    catch (error) { toast(error.message, 'error'); }
  }


  function readFileDataUrl(file, label = 'Gambar') {
    if (!file) return Promise.resolve('');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return Promise.reject(new Error(`${label} harus berupa PNG, JPEG, atau WebP.`));
    if (file.size > 1.5 * 1024 * 1024) return Promise.reject(new Error(`Ukuran ${label.toLowerCase()} maksimal 1,5 MB.`));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`${label} gagal dibaca.`));
      reader.readAsDataURL(file);
    });
  }

  function showCheckout() {
    const state = Store.getState();
    const details = cartDetails(state);
    const cashOption = state.settings.cashPickupEnabled !== false ? '<option value="CASH_PICKUP">Tunai saat pickup</option>' : '';
    openModal(`
      <form id="checkout-form">
        <div class="modal-header"><div><h2>Buat pesanan</h2><div class="help">Isi data yang dapat dihubungi oleh Dapur Rini.</div></div><button type="button" class="close-btn" data-modal-close>×</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field"><label>Nama pelanggan</label><input name="customerName" required placeholder="Contoh: Rina Putri"></div>
            <div class="field"><label>Nomor WhatsApp</label><input name="phone" required inputmode="tel" placeholder="08xxxxxxxxxx"></div>
            <div class="field field-full"><label>Metode penerimaan</label><div class="option-cards"><label class="option-card"><input type="radio" name="fulfillment" value="PICKUP" checked> <strong>Ambil sendiri</strong><div class="help">${esc(state.settings.location || 'Lokasi pickup')}</div></label><label class="option-card"><input type="radio" name="fulfillment" value="LALAMOVE"> <strong>Dikirim</strong><div class="help">Ongkir awal ${rupiah(18000)}</div></label></div></div>
            <div class="field field-full" id="address-field" hidden><label>Alamat lengkap</label><textarea name="address" placeholder="Nama jalan, nomor, RT/RW, kelurahan, dan patokan"></textarea></div>
            <div class="field field-full"><label>Catatan pesanan</label><textarea name="note" placeholder="Contoh: sambal dipisah atau waktu pickup"></textarea></div>
            <div class="field field-full"><label>Metode pembayaran</label><select name="paymentMethod"><option value="BANK_TRANSFER">Transfer bank</option><option value="QRIS_STATIC">QRIS</option>${cashOption}</select><span class="help" id="payment-help">Bukti pembayaran diunggah setelah nomor pesanan dibuat.</span></div>
            <div class="field field-full"><label class="check-card"><input type="checkbox" required><span><strong>Data pesanan sudah benar</strong><small>Saya memahami kuota ditahan sampai batas pembayaran berakhir.</small></span></label></div>
          </div>
          <div class="summary-box"><div class="summary-row"><span>Subtotal</span><strong>${rupiah(details.subtotal)}</strong></div><div class="summary-row"><span>Ongkir</span><strong id="delivery-fee">${rupiah(0)}</strong></div><div class="summary-row total"><span>Total</span><strong id="checkout-total">${rupiah(details.subtotal)}</strong></div></div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-ghost" id="back-cart">Kembali</button><button type="submit" class="btn btn-primary">Buat pesanan</button></div>
      </form>`, true);

    const form = document.getElementById('checkout-form');
    const addressField = document.getElementById('address-field');
    const feeEl = document.getElementById('delivery-fee');
    const totalEl = document.getElementById('checkout-total');
    const paymentSelect = form.elements.paymentMethod;
    const paymentHelp = document.getElementById('payment-help');
    const syncFulfillment = () => {
      const isDelivery = form.elements.fulfillment.value === 'LALAMOVE';
      addressField.hidden = !isDelivery;
      form.elements.address.required = isDelivery;
      feeEl.textContent = isDelivery ? rupiah(18000) : rupiah(0);
      totalEl.textContent = rupiah(details.subtotal + (isDelivery ? 18000 : 0));
      const cash = [...paymentSelect.options].find((option) => option.value === 'CASH_PICKUP');
      if (cash) cash.disabled = isDelivery;
      if (isDelivery && paymentSelect.value === 'CASH_PICKUP') paymentSelect.value = 'BANK_TRANSFER';
      paymentHelp.textContent = paymentSelect.value === 'CASH_PICKUP' ? 'Bayar saat mengambil pesanan.' : 'Bukti pembayaran diunggah setelah nomor pesanan dibuat.';
    };
    form.querySelectorAll('input[name="fulfillment"]').forEach((radio) => radio.onchange = syncFulfillment);
    paymentSelect.onchange = syncFulfillment;
    syncFulfillment();
    document.getElementById('back-cart').onclick = showCart;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const order = await Store.checkout({
          customerName: data.get('customerName'), phone: data.get('phone'), fulfillment: data.get('fulfillment'),
          address: data.get('address') || '', note: data.get('note') || '', paymentMethod: data.get('paymentMethod')
        });
        renderCustomer();
        showSuccess(order);
      } catch (error) { toast(error.message, 'error'); }
      finally { submit.disabled = false; }
    };
  }

  function defaultPaidAtInput() {
    const date = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 16);
  }

  function showPaymentProofForm(code, phone, total, { returnToTracking = false } = {}) {
    openModal(`<form id="proof-form"><div class="modal-header"><div><h2>Unggah bukti pembayaran</h2><div class="help">Pesanan ${esc(code)}</div></div><button type="button" class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="form-grid"><div class="field"><label>Nama pengirim</label><input name="senderName" required maxlength="100" placeholder="Nama pada rekening atau aplikasi"></div><div class="field"><label>Nominal yang dibayar</label><input name="reportedAmount" type="number" min="0" required value="${Number(total || 0)}"></div><div class="field"><label>Waktu pembayaran</label><input name="paidAt" type="datetime-local" required value="${defaultPaidAtInput()}"></div><div class="field"><label>Foto bukti</label><input name="proof" type="file" accept="image/png,image/jpeg,image/webp" required><span class="help">PNG, JPEG, atau WebP. Maksimal 1,5 MB.</span></div></div><div class="notice info" style="margin-top:14px">Pemilik tetap mencocokkan dana melalui aplikasi bank atau QRIS. Foto bukan satu-satunya dasar penerimaan pembayaran.</div></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-primary">Kirim untuk dicek</button></div></form>`, true);
    const form = document.getElementById('proof-form');
    form.onsubmit = async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"], button:not([type])');
      submit.disabled = true;
      try {
        const file = form.elements.proof.files[0];
        const proofData = await readFileDataUrl(file, 'Bukti pembayaran');
        await Store.submitPaymentProof({
          code, phone, senderName: form.elements.senderName.value,
          reportedAmount: Number(form.elements.reportedAmount.value),
          paidAt: fromJakartaLocalInput(form.elements.paidAt.value),
          proofName: file.name, proofData
        });
        toast('Bukti pembayaran sudah dikirim untuk dicek.', 'success');
        if (returnToTracking) showTracking(code, phone);
        else { closeModal(); showTracking(code, phone); }
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    };
  }

  function showSuccess(order) {
    const state = Store.getState();
    const cash = order.paymentMethod === 'CASH_PICKUP';
    const confirmMessage = `Halo Dapur Rini, saya sudah membuat pesanan ${order.code}.\n\nNama: ${order.customerName}\nTotal: ${rupiah(order.total)}.`;
    const instruction = order.paymentMethod === 'QRIS_STATIC'
      ? `<div class="notice info" style="margin-top:12px"><strong>Pembayaran QRIS</strong><br>Bayar ${rupiah(order.total)}, lalu unggah bukti.</div>${state.settings.qrisImage ? `<div class="payment-qris"><img src="${esc(state.settings.qrisImage)}" alt="QRIS Dapur Rini"><small>Simpan atau pindai QRIS ini melalui aplikasi pembayaran.</small></div>` : '<div class="notice warning" style="margin-top:12px">QRIS belum ditampilkan. Hubungi Dapur Rini untuk menerima gambar QRIS.</div>'}`
      : `<div class="notice info" style="margin-top:12px"><strong>Transfer ke</strong><br>${esc(state.settings.bankAccount || 'Rekening belum diatur. Hubungi Dapur Rini sebelum membayar.')}<br>Nominal: ${rupiah(order.total)}</div>`;
    openModal(`
      <div class="modal-header"><h2>Pesanan berhasil dibuat</h2><button class="close-btn" data-modal-close>×</button></div>
      <div class="modal-body">
        <div class="success-hero"><div class="success-icon">✓</div><h2>Terima kasih, ${esc(order.customerName)}!</h2><p>${cash ? 'Pesanan akan dibayar saat pickup.' : 'Selesaikan pembayaran dan kirim bukti sebelum batas waktu.'}</p></div>
        <div class="code-box">${esc(order.code)}</div>
        ${cash ? '' : `<div class="payment-deadline-card"><span>Batas pembayaran</span><strong data-payment-countdown="${esc(order.paymentDeadline || '')}">${paymentRemainingText(order.paymentDeadline)}</strong><small>${order.paymentDeadline ? dateTime(order.paymentDeadline) : ''}</small></div>`}
        <div class="summary-box"><div class="summary-row"><span>Total</span><strong>${rupiah(order.total)}</strong></div><div class="summary-row"><span>Pembayaran</span><strong>${paymentMethodLabel[order.paymentMethod] || order.paymentMethod}</strong></div><div class="summary-row"><span>Tanggal pesanan</span><strong>${dateOnly(order.deliveryAt)}</strong></div></div>
        ${cash ? '<div class="notice success" style="margin-top:12px">Simpan nomor pesanan ini dan tunjukkan saat pickup.</div>' : instruction}
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" data-modal-close>Kembali ke menu</button><a class="btn btn-whatsapp" href="${waLink(state, confirmMessage)}" target="_blank" rel="noopener">Hubungi Dapur Rini</a>${cash ? '' : '<button class="btn btn-primary" id="upload-proof-success">Unggah bukti</button>'}<button class="btn btn-secondary" id="track-success">Lacak pesanan</button></div>`);
    const upload = document.getElementById('upload-proof-success');
    if (upload) upload.onclick = () => showPaymentProofForm(order.code, order.phone, order.total);
    document.getElementById('track-success').onclick = () => showTracking(order.code, order.phone);
    startCountdowns();
  }

  function showTracking(prefill = '', phonePrefill = '') {
    openModal(`
      <div class="modal-header"><div><h2>Lacak pesanan</h2><div class="help">Masukkan nomor pesanan dan nomor WhatsApp yang digunakan saat checkout.</div></div><button class="close-btn" data-modal-close aria-label="Tutup dialog">×</button></div>
      <div class="modal-body"><form id="tracking-form" class="form-grid"><div class="field"><label>Nomor pesanan</label><input id="tracking-code" required value="${esc(prefill)}" placeholder="DR-260724-0001"></div><div class="field"><label>Nomor WhatsApp</label><input id="tracking-phone" required inputmode="tel" value="${esc(phonePrefill)}" placeholder="08xxxxxxxxxx"></div><div class="field field-full"><button class="btn btn-primary">Cari pesanan</button></div></form><div id="tracking-result" style="margin-top:16px"></div><div class="help" style="margin-top:12px">Gunakan kombinasi nomor pesanan dan telepon yang sama dengan data checkout.</div></div>`);
    const form = document.getElementById('tracking-form');
    form.onsubmit = async (event) => {
      event.preventDefault();
      await renderTrackingResult(document.getElementById('tracking-code').value, document.getElementById('tracking-phone').value);
    };
    if (prefill && phonePrefill) renderTrackingResult(prefill, phonePrefill);
  }

  async function renderTrackingResult(code, phone) {
    const state = Store.getState();
    const root = document.getElementById('tracking-result');
    root.innerHTML = '<div class="notice info">Mencari pesanan...</div>';
    try {
      const order = await Store.trackOrder(code, phone);
      const contactMessage = `Halo Dapur Rini, saya ingin menanyakan status pesanan ${order.code}.`;
      const deadline = order.paymentDeadline && !['PAID', 'EXPIRED', 'REJECTED', 'REFUND_PENDING', 'REFUNDED'].includes(order.paymentStatus)
        ? `<div class="payment-deadline-card compact"><span>Sisa waktu pembayaran</span><strong data-payment-countdown="${esc(order.paymentDeadline)}">${paymentRemainingText(order.paymentDeadline)}</strong><small>${dateTime(order.paymentDeadline)}</small></div>` : '';
      const canUpload = ['UNPAID', 'NEED_NEW_PROOF', 'EXPIRED'].includes(order.paymentStatus) && order.paymentMethod !== 'CASH_PICKUP';
      const statusClass = ['EXPIRED', 'REJECTED', 'REFUND_PENDING'].includes(order.paymentStatus) ? 'danger' : ['PAID', 'REFUNDED'].includes(order.paymentStatus) ? 'success' : 'info';
      root.innerHTML = `
        <div class="notice ${statusClass}"><strong>${esc(order.code)}</strong><br>${esc(order.customerName)} • ${dateTime(order.createdAt)}</div>
        ${deadline}
        <div class="summary-box"><div class="summary-row"><span>Status pembayaran</span><strong>${paymentLabel[order.paymentStatus] || esc(order.paymentStatus)}</strong></div><div class="summary-row"><span>Status pesanan</span><strong>${orderLabel[order.orderStatus] || esc(order.orderStatus)}</strong></div><div class="summary-row"><span>Pembayaran</span><strong>${paymentMethodLabel[order.paymentMethod] || esc(order.paymentMethod)}</strong></div><div class="summary-row"><span>Penerimaan</span><strong>${order.fulfillment === 'PICKUP' ? 'Ambil sendiri' : 'Dikirim'}</strong></div><div class="summary-row"><span>Total</span><strong>${rupiah(order.total)}</strong></div></div>
        ${order.reviewReason ? `<div class="notice warning" style="margin-top:12px"><strong>Catatan Dapur Rini</strong><br>${esc(order.reviewReason)}</div>` : ''}
        ${order.paymentStatus === 'EXPIRED' ? '<div class="notice danger" style="margin-top:12px">Batas pembayaran sudah lewat dan kuota telah dilepas. Bukti pembayaran yang terlambat tetap dapat dikirim untuk diperiksa.</div>' : ''}
        <div class="cart-list" style="margin-top:12px">${order.items.map((item) => `<div class="cart-item"><div><h4>${esc(item.name)}</h4><small>${item.qty} ${esc(item.unit)}</small></div></div>`).join('')}</div>
        <div class="quick-actions" style="margin-top:14px">${canUpload ? '<button class="btn btn-primary" id="tracking-upload-proof">Unggah bukti pembayaran</button>' : ''}<a class="btn btn-whatsapp" href="${waLink(state, contactMessage)}" target="_blank" rel="noopener">Hubungi Dapur Rini</a></div>`;
      const upload = document.getElementById('tracking-upload-proof');
      if (upload) upload.onclick = () => showPaymentProofForm(order.code, phone, order.total, { returnToTracking: true });
      startCountdowns();
    } catch (error) {
      root.innerHTML = `<div class="notice danger">${esc(error.message)}</div>`;
    }
  }

  function startCountdowns() {
    clearInterval(countdownTimer);
    clearInterval(expiryTimer);
    const refreshCountdowns = () => {
      document.querySelectorAll('[data-countdown]').forEach((element) => { element.textContent = countdownText(element.dataset.countdown); });
      document.querySelectorAll('[data-payment-countdown]').forEach((element) => { element.textContent = paymentRemainingText(element.dataset.paymentCountdown); });
    };
    refreshCountdowns();
    countdownTimer = setInterval(refreshCountdowns, 1000);
    expiryTimer = setInterval(async () => {
      try {
        await Store.processExpiredOrders();
        const y = window.scrollY;
        if (isAdminRoute) renderAdmin(); else renderCustomer();
        requestAnimationFrame(() => window.scrollTo(0, y));
      } catch (_) {}
    }, 15000);
  }

  /* ADMIN */
  function renderAdmin() {
    clearInterval(countdownTimer);
    clearInterval(expiryTimer);
    if (!Store.isLoggedIn()) { renderLogin(); return; }
    const state = Store.getState();
    const unreadCount = state.notifications.filter((item) => !item.read).length;
    if (previousUnreadCount !== null && unreadCount > previousUnreadCount && state.settings.notificationSound) playNotificationTone();
    previousUnreadCount = unreadCount;
    app.innerHTML = `
      <div class="admin-shell">
        <div class="demo-ribbon">${state.settings.operationMode === 'PRODUCTION' ? 'Operasional Dapur Rini' : 'Dashboard Uji Coba'}</div>
        <header class="admin-topbar"><div class="admin-topbar-inner"><a class="brand" href="index.html?view=admin"><span class="brand-mark">DR</span><span class="brand-copy">Admin Dapur Rini<small>Tegal Alur, Jakarta Barat</small></span></a><div class="header-actions"><a class="btn btn-ghost btn-sm" href="index.html">Lihat toko</a><button class="icon-btn theme-toggle" data-admin-action="toggle-theme" aria-label="Ganti tema">${currentTheme() === 'dark' ? '☀' : '☾'}</button><button class="notification-bell" data-admin-page="payments" aria-label="Buka pembayaran"><span>♢</span>${unreadCount ? `<em>${unreadCount}</em>` : ''}</button><button class="btn btn-dark btn-sm" data-admin-action="logout">Keluar</button></div></div></header>
        <div class="admin-layout">
          <aside class="admin-sidebar">${adminNav()}</aside>
          <main class="admin-main">${adminPage(state)}</main>
        </div>
        <nav class="bottom-admin-nav">${adminBottomNav()}</nav>
      </div>`;
    bindAdminEvents();
    startCountdowns();
  }

  function adminNav() {
    const links = [
      ['dashboard', '⌂', 'Hari ini'], ['menus', '☰', 'Menu'], ['payments', '✓', 'Pembayaran'], ['production', '◇', 'Produksi'],
      ['orders', '▤', 'Pesanan'], ['settings', '⚙', 'Pengaturan']
    ];
    return `<div class="admin-nav">${links.map(([id, icon, label]) => `<button class="${activeAdminPage === id ? 'active' : ''}" data-admin-page="${id}"><span>${icon}</span>${label}</button>`).join('')}</div>`;
  }

  function adminBottomNav() {
    const links = [['dashboard', '⌂', 'Hari ini'], ['menus', '☰', 'Menu'], ['payments', '✓', 'Bayar'], ['production', '◇', 'Produksi'], ['orders', '▤', 'Pesanan'], ['settings', '⚙', 'Atur']];
    return links.map(([id, icon, label]) => `<button class="${activeAdminPage === id ? 'active' : ''}" data-admin-page="${id}"><span>${icon}</span>${label}</button>`).join('');
  }

  function renderLogin() {
    app.innerHTML = `<main class="login-page"><section class="login-card"><a class="brand" href="index.html"><span class="brand-mark">DR</span><span class="brand-copy">Dapur Rini<small>Dashboard operasional</small></span></a><h1>Masuk admin</h1><p>Kelola menu, pembayaran, produksi, dan pengiriman dari satu tampilan.</p><div class="login-demo"><strong>Sesi terlindungi</strong><br>Gunakan kredensial yang dikonfigurasi operator aplikasi.</div><form id="login-form" class="form-grid"><div class="field field-full"><label>Username</label><input name="username" value="admin" autocomplete="username" required></div><div class="field field-full"><label>Password</label><input name="password" type="password" autocomplete="current-password" required autofocus></div><div class="field field-full"><label>Kode perangkat</label><input name="devicePin" inputmode="numeric" autocomplete="one-time-code" placeholder="Isi hanya saat diminta"><span class="help">HP yang sudah dipercaya tidak perlu mengisi kode ini lagi.</span></div><div class="field field-full"><button type="submit" class="btn btn-primary btn-block">Masuk ke dashboard</button></div><div class="field field-full"><a class="btn btn-ghost btn-block" href="index.html">Kembali ke toko</a></div></form></section></main>`;
    document.getElementById('login-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        if (await Store.login(form.username.value, form.password.value, form.devicePin.value)) { renderAdmin(); toast('Login berhasil.', 'success'); }
        else toast('Username atau password salah.', 'error');
      } catch (error) { toast(error.message, 'error'); }
      finally { submit.disabled = false; }
    };
  }

  function adminPage(state) {
    if (activeAdminPage === 'payments') return adminPayments(state);
    if (activeAdminPage === 'menus') return adminMenus(state);
    if (activeAdminPage === 'batches') return adminBatches(state);
    if (activeAdminPage === 'orders') return adminOrders(state);
    if (activeAdminPage === 'production') return adminProduction(state);
    if (activeAdminPage === 'delivery') return adminDelivery(state);
    if (activeAdminPage === 'testimonials') return adminTestimonials(state);
    if (activeAdminPage === 'notifications') return adminNotifications(state);
    if (activeAdminPage === 'settings') return adminSettings(state);
    return adminDashboard(state);
  }

  function pageHeading(title, desc, action = '') {
    return `<div class="admin-heading"><div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
  }

  function adminFilterBar(scope, searchPlaceholder, selects, resultText) {
    const filters = adminFilters[scope];
    return `
      <div class="admin-filter-bar">
        <div class="admin-search search-box">
          <input id="${scope}-search" type="search" value="${esc(filters.search)}" placeholder="${esc(searchPlaceholder)}" data-filter-scope="${scope}" data-filter-key="search" autocomplete="off">
        </div>
        ${selects.map((select) => `<label class="admin-filter-select"><span>${esc(select.label)}</span><select id="${scope}-${select.key}" data-filter-scope="${scope}" data-filter-key="${select.key}">${select.options.map(([value, label]) => `<option value="${esc(value)}" ${filters[select.key] === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`).join('')}
        <div class="filter-result">${esc(resultText)}</div>
        <button class="btn btn-ghost btn-sm filter-reset" data-admin-action="clear-filters" data-filter-scope="${scope}">Reset filter</button>
      </div>`;
  }

  function adminDashboard(state) {
    const toCheck = state.orders.filter((order) => ['PENDING_REVIEW', 'LATE_PAYMENT_REVIEW'].includes(order.paymentStatus));
    const checkAgain = state.orders.filter((order) => ['CHECK_LATER', 'NEED_NEW_PROOF'].includes(order.paymentStatus));
    const todayKey = jakartaDateKey();
    const paidToday = state.orders.filter((order) => order.paymentStatus === 'PAID' && jakartaDateKey(order.verifiedAt || order.reviewedAt || order.createdAt) === todayKey);
    const paidRevenue = paidToday.reduce((sum, order) => sum + order.total, 0);
    const activeBatches = state.batches.filter((batch) => ['OPEN', 'CLOSING_SOON', 'WAITING_OPENER', 'OPENER_PENDING_PAYMENT'].includes(batch.status));
    const upcoming = state.orders.filter((order) => ['PAID', 'CASH_DUE'].includes(order.paymentStatus) && !['CANCELLED', 'COMPLETED'].includes(order.orderStatus));
    const urgent = [...toCheck, ...checkAgain].slice(0, 5);
    return `${pageHeading('Hari ini', 'Hal yang perlu dikerjakan pemilik sekarang.', '<button class="btn btn-danger" data-admin-action="close-all">Tutup semua PO</button>')}
      <div class="stats-grid"><button class="stat-card stat-button" data-admin-page="payments"><span>Perlu dicek</span><strong>${toCheck.length}</strong></button><button class="stat-card stat-button" data-admin-page="payments"><span>Cek lagi</span><strong>${checkAgain.length}</strong></button><button class="stat-card stat-button" data-admin-page="production"><span>Pesanan produksi</span><strong>${upcoming.length}</strong></button><div class="stat-card"><span>PO aktif</span><strong>${activeBatches.length}</strong></div><div class="stat-card"><span>Diterima hari ini</span><strong>${rupiah(paidRevenue)}</strong></div></div>
      <section class="admin-panel"><div class="panel-head"><h2>Yang perlu ditangani</h2><button class="btn btn-primary btn-sm" data-admin-page="payments">Buka pembayaran</button></div><div class="admin-list">${urgent.length ? urgent.map((order) => paymentAdminRow(order, state)).join('') : '<div class="empty-state"><strong>Tidak ada pembayaran yang menunggu</strong><p>Pemilik dapat melanjutkan ke produksi.</p></div>'}</div></section>
      <section class="admin-panel"><div class="panel-head"><h2>Tindakan cepat</h2></div><div class="quick-actions"><button class="btn btn-primary" data-admin-page="payments">Cek pembayaran</button><button class="btn btn-secondary" data-admin-page="production">Lihat produksi</button><button class="btn btn-ghost" data-admin-page="orders">Cari pesanan</button><button class="btn btn-ghost" data-admin-page="settings">Atur menu dan PO</button></div></section>
      <section class="admin-panel"><div class="panel-head"><h2>Pesanan terbaru</h2><button class="btn btn-ghost btn-sm" data-admin-page="orders">Lihat semua</button></div><div class="admin-list">${state.orders.slice(0, 5).map((order) => orderAdminRow(order, state)).join('')}</div></section>`;
  }

  function orderAdminRow(order, state) {
    const firstItem = order.items[0];
    const needsAction = ['PENDING_REVIEW', 'LATE_PAYMENT_REVIEW', 'CHECK_LATER', 'NEED_NEW_PROOF'].includes(order.paymentStatus);
    const deadline = order.paymentDeadline && ['UNPAID', 'PENDING_REVIEW', 'CHECK_LATER', 'NEED_NEW_PROOF'].includes(order.paymentStatus)
      ? `<span class="order-deadline"><b data-payment-countdown="${esc(order.paymentDeadline)}">${paymentRemainingText(order.paymentDeadline)}</b><small>batas ${timeOnly(order.paymentDeadline)}</small></span>` : '';
    return `<article class="admin-row admin-order-row ${needsAction ? 'order-pending' : ''}"><div class="admin-row-thumb"><img src="${esc(itemImage(firstItem, state))}" alt=""></div><div class="admin-row-main"><div class="row-title-with-badge"><h3>${esc(order.code)} • ${esc(order.customerName)}</h3>${deadline}</div><p>${order.items.map((item) => `${esc(item.name)} × ${item.qty}`).join(', ')}<br>${paymentLabel[order.paymentStatus] || esc(order.paymentStatus)} • ${orderLabel[order.orderStatus] || esc(order.orderStatus)} • ${rupiah(order.total)}</p>${order.paymentStatus === 'EXPIRED' ? '<p class="danger-text">Batas pembayaran lewat dan kuota sudah dilepas.</p>' : ''}</div><div class="admin-row-actions">${needsAction ? '<button class="btn btn-primary btn-sm" data-admin-page="payments">Buka pembayaran</button>' : ''}<button class="btn btn-ghost btn-sm" data-admin-action="order-detail" data-order-id="${esc(order.id)}">Detail</button></div></article>`;
  }

  function adminMenus(state) {
    return `${pageHeading('Kelola menu', 'Edit katalog dan buat beberapa batch PO untuk menu yang sama.', '<button class="btn btn-primary" data-admin-action="add-menu">+ Tambah menu</button>')}<section class="admin-panel"><div class="admin-menu-grid">${state.menus.map((menu) => {
      const menuBatches = state.batches.filter((batch) => batch.menuId === menu.id);
      const activeBatch = Store.selectBatchForMenu(menu.id);
      return `<article class="admin-menu-card"><img src="${esc(menuImage(menu))}" alt="${esc(menu.imageAlt || `Foto ${menu.name}`)}"><div class="admin-menu-body"><div class="admin-menu-title"><div><span>${esc(menu.category)}</span><h3>${esc(menu.name)}</h3></div><span class="badge ${menu.active ? 'badge-open' : 'badge-closed'}">${menu.active ? 'Aktif' : 'Nonaktif'}</span></div><p>${rupiah(menu.price)} / ${esc(menu.unit)} • Pembuka ${menu.openerMin} • Kapasitas default ${menu.defaultCapacity}</p><p>${menuBatches.length} batch • Prioritas pelanggan: <strong>${activeBatch ? (batchLabel[activeBatch.status]?.[0] || esc(activeBatch.status)) : 'Belum ada batch'}</strong></p><div class="admin-row-actions"><button class="btn btn-ghost btn-sm" data-admin-action="edit-menu" data-menu-id="${esc(menu.id)}">Edit</button><button class="btn btn-secondary btn-sm" data-admin-action="add-batch" data-menu-id="${esc(menu.id)}">+ Batch baru</button><button class="btn ${menu.active ? 'btn-warning' : 'btn-success'} btn-sm" data-admin-action="toggle-menu" data-menu-id="${esc(menu.id)}">${menu.active ? 'Nonaktifkan' : 'Aktifkan'}</button></div></div></article>`;
    }).join('')}</div></section>`;
  }

  function adminBatches(state) {
    const filter = adminFilters.batches;
    const statusOptions = [['ALL', 'Semua status'], ...Object.entries(batchLabel).map(([key, value]) => [key, value[0]])];
    const rows = state.batches.map((batch) => ({ batch, menu: state.menus.find((menu) => menu.id === batch.menuId) }))
      .filter(({ batch, menu }) => {
        const searchOk = !filter.search || textMatches(`${menu?.name} ${menu?.category} ${batch.id}`, filter.search);
        const statusOk = filter.status === 'ALL' || batch.status === filter.status;
        return searchOk && statusOk;
      });
    return `${pageHeading('Batch PO', 'Cari dan atur status, kuota, harga, serta waktu tutup setiap menu.', '<button class="btn btn-primary" data-admin-action="add-batch">+ Buat batch</button>')}
      <section class="admin-panel">
        ${adminFilterBar('batches', 'Cari nama menu atau ID batch...', [{ label: 'Status batch', key: 'status', options: statusOptions }], `${rows.length} dari ${state.batches.length} batch`)}
        <div class="admin-list batch-card-list">${rows.length ? rows.map(({ batch, menu }) => { const [label, badge] = batchLabel[batch.status] || [batch.status, 'badge-draft']; return `<article class="admin-row batch-admin-card"><div class="admin-row-thumb"><img src="${esc(menuImage(menu))}" alt=""></div><div class="admin-row-main"><div class="row-title-with-badge"><h3>${esc(menu.name)}</h3><span class="badge ${badge}">${label}</span></div><p>${rupiah(batch.price)} / ${esc(menu.unit)} • Terjual ${batch.soldQty} • Ditahan ${batch.heldQty} • Sisa ${Store.availableQty(batch)}</p><p>Kapasitas ${batch.capacity} • Tutup ${dateTime(batch.closesAt)} • Kirim ${dateTime(batch.deliveryAt)}</p></div><div class="admin-row-actions"><button class="btn btn-ghost btn-sm" data-admin-action="edit-batch" data-batch-id="${batch.id}">Atur batch</button></div></article>`; }).join('') : '<div class="empty-state"><strong>Batch tidak ditemukan</strong><p>Ubah kata kunci atau status filter.</p></div>'}</div>
      </section>`;
  }

  function paymentAdminRow(order, state) {
    const firstItem = order.items[0];
    const toCheck = ['PENDING_REVIEW', 'LATE_PAYMENT_REVIEW'].includes(order.paymentStatus);
    const checkAgain = order.paymentStatus === 'CHECK_LATER';
    const needProof = order.paymentStatus === 'NEED_NEW_PROOF';
    const refund = order.paymentStatus === 'REFUND_PENDING';
    const message = needProof
      ? `Halo ${order.customerName}, bukti pembayaran untuk pesanan ${order.code} perlu diunggah ulang. ${order.reviewReason || ''}`
      : `Halo ${order.customerName}, kami ingin mengonfirmasi pembayaran pesanan ${order.code}.`;
    const proof = order.proofKey
      ? `<button class="proof-thumb" data-admin-action="order-detail" data-order-id="${esc(order.id)}"><img src="/api/proofs/${encodeURIComponent(order.proofKey)}" alt="Bukti pembayaran ${esc(order.code)}"></button>`
      : `<div class="admin-row-thumb"><img src="${esc(itemImage(firstItem, state))}" alt=""></div>`;
    return `<article class="admin-row admin-order-row ${toCheck ? 'order-pending' : ''}">${proof}<div class="admin-row-main"><div class="row-title-with-badge"><h3>${esc(order.code)} • ${esc(order.customerName)}</h3><span class="badge ${toCheck ? 'badge-pending' : refund ? 'badge-closing' : 'badge-draft'}">${paymentLabel[order.paymentStatus] || esc(order.paymentStatus)}</span></div><p><strong>${rupiah(order.total)}</strong> • ${paymentMethodLabel[order.paymentMethod] || esc(order.paymentMethod)}<br>${order.reportedSenderName ? `Pengirim: ${esc(order.reportedSenderName)} • Dilaporkan ${rupiah(order.reportedAmount)}` : 'Belum ada data bukti pembayaran'}</p>${order.reviewReason ? `<p class="danger-text">${esc(order.reviewReason)}</p>` : ''}</div><div class="admin-row-actions">${toCheck || checkAgain ? `<button class="btn btn-success btn-sm" data-admin-action="payment-receive" data-order-id="${esc(order.id)}">Pembayaran diterima</button><button class="btn btn-secondary btn-sm" data-admin-action="payment-check-later" data-order-id="${esc(order.id)}">Belum masuk</button><button class="btn btn-warning btn-sm" data-admin-action="payment-request-proof" data-order-id="${esc(order.id)}">Minta bukti baru</button><button class="btn btn-ghost btn-sm" data-admin-action="payment-problem" data-order-id="${esc(order.id)}">Masalah pembayaran</button>` : ''}${needProof ? `<a class="btn btn-whatsapp btn-sm" href="${waCustomerLink(order.phone, message)}" target="_blank" rel="noopener">Hubungi pelanggan</a>` : ''}${refund ? `<button class="btn btn-success btn-sm" data-admin-action="payment-refunded" data-order-id="${esc(order.id)}">Dana sudah dikembalikan</button>` : ''}<button class="btn btn-ghost btn-sm" data-admin-action="order-detail" data-order-id="${esc(order.id)}">Detail</button></div></article>`;
  }

  function adminPayments(state) {
    const filter = adminFilters.payments;
    const statusOptions = [['TO_CHECK', 'Perlu dicek'], ['CHECK_AGAIN', 'Cek lagi'], ['PROBLEM', 'Bermasalah'], ['DONE', 'Selesai'], ['ALL', 'Semua']];
    const groups = {
      TO_CHECK: new Set(['PENDING_REVIEW', 'LATE_PAYMENT_REVIEW']),
      CHECK_AGAIN: new Set(['CHECK_LATER', 'NEED_NEW_PROOF']),
      PROBLEM: new Set(['EXPIRED', 'REJECTED', 'REFUND_PENDING']),
      DONE: new Set(['PAID', 'REFUNDED'])
    };
    const rows = state.orders.filter((order) => {
      const searchText = `${order.code} ${order.customerName} ${order.phone} ${order.reportedSenderName || ''}`;
      const statusOk = filter.status === 'ALL' || groups[filter.status]?.has(order.paymentStatus);
      return (!filter.search || textMatches(searchText, filter.search)) && statusOk;
    });
    const toCheck = state.orders.filter((order) => groups.TO_CHECK.has(order.paymentStatus)).length;
    const checkAgain = state.orders.filter((order) => groups.CHECK_AGAIN.has(order.paymentStatus)).length;
    const problems = state.orders.filter((order) => groups.PROBLEM.has(order.paymentStatus)).length;
    const todayKey = jakartaDateKey();
    const receivedToday = state.orders.filter((order) => order.paymentStatus === 'PAID' && jakartaDateKey(order.verifiedAt || order.reviewedAt || order.createdAt) === todayKey);
    return `${pageHeading('Pembayaran', 'Lihat, cocokkan di aplikasi bank atau QRIS, lalu tekan satu keputusan.')}
      <div class="stats-grid"><div class="stat-card"><span>Perlu dicek</span><strong>${toCheck}</strong></div><div class="stat-card"><span>Cek lagi</span><strong>${checkAgain}</strong></div><div class="stat-card"><span>Bermasalah</span><strong>${problems}</strong></div><div class="stat-card"><span>Diterima hari ini</span><strong>${receivedToday.length}</strong></div><div class="stat-card"><span>Total hari ini</span><strong>${rupiah(receivedToday.reduce((sum, order) => sum + order.total, 0))}</strong></div></div>
      <section class="admin-panel"><div class="notice info"><strong>Cara memeriksa:</strong> buka aplikasi bank atau QRIS, cocokkan nama, nominal, dan waktu. Bukti foto hanya membantu pencarian.</div>${adminFilterBar('payments', 'Cari kode, nama, atau telepon...', [{ label: 'Daftar', key: 'status', options: statusOptions }], `${rows.length} pembayaran`)}<div class="admin-list">${rows.length ? rows.map((order) => paymentAdminRow(order, state)).join('') : '<div class="empty-state"><strong>Tidak ada pembayaran pada daftar ini</strong></div>'}</div></section>`;
  }

  function adminOrders(state) {
    const filter = adminFilters.orders;
    const counts = Object.fromEntries(Object.keys(paymentLabel).map((key) => [key, state.orders.filter((o) => o.paymentStatus === key).length]));
    const paymentOptions = [['ALL', 'Semua pembayaran'], ...Object.entries(paymentLabel).map(([key, label]) => [key, label])];
    const statusOptions = [['ALL', 'Semua tahap pesanan'], ...Object.entries(orderLabel).map(([key, label]) => [key, label])];
    const orders = state.orders.filter((order) => {
      const searchText = `${order.code} ${order.customerName} ${order.phone} ${order.address} ${order.items.map((item) => item.name).join(' ')}`;
      return (!filter.search || textMatches(searchText, filter.search))
        && (filter.payment === 'ALL' || order.paymentStatus === filter.payment)
        && (filter.status === 'ALL' || order.orderStatus === filter.status);
    });
    return `${pageHeading('Pesanan', 'Cari pelanggan, periksa pembayaran, dan pantau tahap pemrosesan.')}
      <div class="stats-grid"><div class="stat-card"><span>Perlu verifikasi</span><strong>${counts.PENDING_REVIEW || 0}</strong></div><div class="stat-card"><span>Dibayar</span><strong>${counts.PAID || 0}</strong></div><div class="stat-card"><span>Kedaluwarsa</span><strong>${counts.EXPIRED || 0}</strong></div><div class="stat-card"><span>Total pesanan</span><strong>${state.orders.length}</strong></div></div>
      <section class="admin-panel">
        ${adminFilterBar('orders', 'Cari kode, pelanggan, telepon, atau menu...', [{ label: 'Pembayaran', key: 'payment', options: paymentOptions }, { label: 'Tahap pesanan', key: 'status', options: statusOptions }], `${orders.length} dari ${state.orders.length} pesanan`)}
        <div class="admin-list">${orders.length ? orders.map((order) => orderAdminRow(order, state)).join('') : '<div class="empty-state"><strong>Pesanan tidak ditemukan</strong><p>Ubah pencarian atau filter status.</p></div>'}</div>
      </section>`;
  }

  function adminProduction(state) {
    const filter = adminFilters.production;
    const productionStatuses = ['CONFIRMED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'READY_FOR_PICKUP'];
    const statusOptions = [['ALL', 'Semua tahap produksi'], ...productionStatuses.map((status) => [status, orderLabel[status] || status])];
    const eligibleOrders = state.orders.filter((order) => ['PAID', 'CASH_DUE'].includes(order.paymentStatus) && !['CANCELLED', 'COMPLETED'].includes(order.orderStatus))
      .filter((order) => {
        const searchText = `${order.code} ${order.customerName} ${order.items.map((item) => item.name).join(' ')}`;
        return (!filter.search || textMatches(searchText, filter.search)) && (filter.status === 'ALL' || order.orderStatus === filter.status);
      });
    const groups = new Map();
    eligibleOrders.forEach((order) => {
      const dateKey = String(order.deliveryAt).slice(0, 10);
      if (!groups.has(dateKey)) groups.set(dateKey, { deliveryAt: order.deliveryAt, orders: [], lines: new Map() });
      const group = groups.get(dateKey);
      group.orders.push(order);
      order.items.forEach((item) => {
        const current = group.lines.get(item.menuId) || { menuId: item.menuId, name: item.name, image: itemImage(item, state), qty: 0, unit: item.unit, orders: 0 };
        current.qty += item.qty;
        current.orders += 1;
        group.lines.set(item.menuId, current);
      });
    });
    const groupList = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    const totalUnits = groupList.reduce((sum, [, group]) => sum + [...group.lines.values()].reduce((lineSum, item) => lineSum + item.qty, 0), 0);
    return `${pageHeading('Produksi', 'Rekap dibagi berdasarkan tanggal pengiriman dan hanya memuat pesanan yang sudah dibayar.')}
      <div class="stats-grid"><div class="stat-card"><span>Tanggal produksi</span><strong>${groupList.length}</strong></div><div class="stat-card"><span>Total unit</span><strong>${totalUnits}</strong></div><div class="stat-card"><span>Pesanan diproses</span><strong>${eligibleOrders.length}</strong></div><div class="stat-card"><span>Jenis menu</span><strong>${new Set(groupList.flatMap(([, group]) => [...group.lines.keys()])).size}</strong></div></div>
      <section class="admin-panel">
        ${adminFilterBar('production', 'Cari menu, kode, atau pelanggan...', [{ label: 'Tahap produksi', key: 'status', options: statusOptions }], `${groupList.length} tanggal dari ${eligibleOrders.length} pesanan`)}
        ${groupList.length ? groupList.map(([dateKey, group]) => `<section class="production-date-group"><div class="panel-head"><div><h2>${dateOnly(group.deliveryAt)}</h2><p>${group.orders.length} pesanan siap diproduksi</p></div><div class="quick-actions"><button class="btn btn-secondary btn-sm" data-admin-action="bulk-order-status" data-status="IN_PRODUCTION" data-delivery-date="${esc(dateKey)}">Sedang dibuat</button><button class="btn btn-success btn-sm" data-admin-action="bulk-order-status" data-status="READY" data-delivery-date="${esc(dateKey)}">Siap diterima</button></div></div><div class="admin-list">${[...group.lines.values()].map((item) => `<article class="admin-row production-row"><div class="admin-row-thumb"><img src="${esc(item.image)}" alt=""></div><div class="admin-row-main"><h3>${esc(item.name)}</h3><p>${item.orders} baris pesanan</p></div><strong class="production-qty">${item.qty} ${esc(item.unit)}</strong></article>`).join('')}</div></section>`).join('') : '<div class="empty-state"><strong>Data produksi tidak ditemukan</strong><p>Verifikasi pembayaran atau ubah filter.</p></div>'}
      </section>`;
  }

  function adminDelivery(state) {
    const filter = adminFilters.delivery;
    const methodOptions = [['ALL', 'Semua metode'], ['LALAMOVE', 'Dikirim'], ['PICKUP', 'Ambil sendiri']];
    const statusOptions = [['ALL', 'Semua status'], ...Object.entries(orderLabel).map(([key, label]) => [key, label])];
    const paid = state.orders.filter((order) => order.paymentStatus === 'PAID');
    const filtered = paid.filter((order) => {
      const searchText = `${order.code} ${order.customerName} ${order.phone} ${order.address} ${order.items.map((item) => item.name).join(' ')}`;
      return (!filter.search || textMatches(searchText, filter.search))
        && (filter.method === 'ALL' || order.fulfillment === filter.method)
        && (filter.status === 'ALL' || order.orderStatus === filter.status);
    });
    return `${pageHeading('Pengiriman', 'Cari penerima dan kelola pengiriman maupun pengambilan mandiri.')}
      <div class="stats-grid"><div class="stat-card"><span>Dikirim</span><strong>${paid.filter((o) => o.fulfillment === 'LALAMOVE').length}</strong></div><div class="stat-card"><span>Ambil sendiri</span><strong>${paid.filter((o) => o.fulfillment === 'PICKUP').length}</strong></div><div class="stat-card"><span>Dalam perjalanan</span><strong>${paid.filter((o) => o.orderStatus === 'ON_DELIVERY').length}</strong></div><div class="stat-card"><span>Selesai</span><strong>${paid.filter((o) => o.orderStatus === 'COMPLETED').length}</strong></div></div>
      <section class="admin-panel">
        ${adminFilterBar('delivery', 'Cari kode, penerima, telepon, atau alamat...', [{ label: 'Metode', key: 'method', options: methodOptions }, { label: 'Status', key: 'status', options: statusOptions }], `${filtered.length} dari ${paid.length} pengiriman`)}
        <div class="admin-list">${filtered.length ? filtered.map((order) => `<article class="admin-row delivery-row"><div class="admin-row-thumb"><img src="${esc(itemImage(order.items[0], state))}" alt=""></div><div class="admin-row-main"><div class="row-title-with-badge"><h3>${esc(order.code)} • ${esc(order.customerName)}</h3><span class="badge ${order.fulfillment === 'LALAMOVE' ? 'badge-pending' : 'badge-open'}">${order.fulfillment === 'LALAMOVE' ? 'Lalamove' : 'Ambil sendiri'}</span></div><p>${esc(order.phone)}${order.address ? ` • ${esc(order.address)}` : ''}</p><p>${order.items.map((item) => `${esc(item.name)} × ${item.qty}`).join(', ')} • ${orderLabel[order.orderStatus] || order.orderStatus}</p></div><div class="admin-row-actions">${order.fulfillment === 'LALAMOVE' ? `<button class="btn btn-secondary btn-sm" data-admin-action="set-order-status" data-order-id="${order.id}" data-status="ON_DELIVERY">Dalam pengiriman</button>` : `<button class="btn btn-secondary btn-sm" data-admin-action="set-order-status" data-order-id="${order.id}" data-status="READY_FOR_PICKUP">Siap diambil</button>`}<button class="btn btn-success btn-sm" data-admin-action="set-order-status" data-order-id="${order.id}" data-status="COMPLETED">Selesai</button><button class="btn btn-ghost btn-sm" data-admin-action="order-detail" data-order-id="${order.id}">Detail</button></div></article>`).join('') : '<div class="empty-state"><strong>Pengiriman tidak ditemukan</strong><p>Ubah kata kunci atau filter.</p></div>'}</div>
      </section>`;
  }

  function adminTestimonials(state) {
    const items = [...(state.testimonials || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    return `${pageHeading('Testimoni', 'Kelola screenshot WhatsApp yang tampil pada landing page.', '<button class="btn btn-primary" data-admin-action="add-testimonial">+ Tambah testimoni</button>')}
      <section class="admin-panel"><div class="notice info">Gunakan screenshot yang sudah mendapat izin. Samarkan nomor telepon, alamat, dan informasi pembayaran pelanggan.</div><div class="admin-testimonial-grid">${items.length ? items.map((item) => `<article class="admin-testimonial-card"><button class="admin-testimonial-image" data-admin-action="preview-testimonial" data-testimonial-id="${esc(item.id)}"><img src="${esc(item.image)}" alt="Screenshot testimoni ${esc(item.name)}"></button><div class="admin-testimonial-body"><div class="row-title-with-badge"><div><h3>${esc(item.name)}</h3><p>${esc(item.menuName)}</p></div><span class="badge ${item.active ? 'badge-open' : 'badge-closed'}">${item.active ? 'Tampil' : 'Disembunyikan'}</span></div><p>${esc(item.caption || '')}</p><div class="admin-row-actions"><button class="btn btn-ghost btn-sm" data-admin-action="edit-testimonial" data-testimonial-id="${esc(item.id)}">Edit</button><button class="btn ${item.active ? 'btn-warning' : 'btn-success'} btn-sm" data-admin-action="toggle-testimonial" data-testimonial-id="${esc(item.id)}">${item.active ? 'Sembunyikan' : 'Tampilkan'}</button><button class="btn btn-danger btn-sm" data-admin-action="delete-testimonial" data-testimonial-id="${esc(item.id)}">Hapus</button></div></div></article>`).join('') : '<div class="empty-state"><strong>Belum ada testimoni</strong></div>'}</div></section>`;
  }

  function adminNotifications(state) {
    const unread = state.notifications.filter((item) => !item.read).length;
    const notifications = [...state.notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return `${pageHeading('Notifikasi', 'Pesanan baru, pembayaran, batas waktu, dan pesan WhatsApp manual.', unread ? '<button class="btn btn-secondary" data-admin-action="mark-all-notifications">Tandai semua dibaca</button>' : '')}
      <div class="stats-grid"><div class="stat-card"><span>Belum dibaca</span><strong>${unread}</strong></div><div class="stat-card"><span>Pesanan baru</span><strong>${notifications.filter((item) => item.type === 'NEW_ORDER').length}</strong></div><div class="stat-card"><span>Segera kedaluwarsa</span><strong>${notifications.filter((item) => item.type === 'EXPIRING_SOON' && !item.read).length}</strong></div><div class="stat-card"><span>Pesan WhatsApp</span><strong>${notifications.filter((item) => ['MANUAL_WHATSAPP', 'WHATSAPP_SIMULATION'].includes(item.channel)).length}</strong></div></div>
      <section class="admin-panel"><div class="notice warning">Notifikasi website membantu pemilik melihat tindakan penting. Pesan WhatsApp tetap dibuka dan dikirim secara manual oleh pemilik.</div><div class="notification-list">${notifications.length ? notifications.map((item) => { const order = item.orderId ? state.orders.find((entry) => entry.id === item.orderId) : null; const waMessage = order ? `PESANAN DAPUR RINI\n\nNomor: ${order.code}\nNama: ${order.customerName}\nTotal: ${rupiah(order.total)}\nStatus: ${paymentLabel[order.paymentStatus]}` : item.message; return `<article class="notification-card ${item.read ? '' : 'unread'}"><span class="notification-type">${notificationIcon(item.type)}</span><div class="notification-main"><div class="row-title-with-badge"><h3>${esc(item.title)}</h3><span>${dateTime(item.createdAt)}</span></div><p>${esc(item.message)}</p><div class="admin-row-actions">${order ? `<button class="btn btn-ghost btn-sm" data-admin-action="order-detail" data-order-id="${esc(order.id)}">Lihat pesanan</button>` : ''}${['MANUAL_WHATSAPP', 'WHATSAPP_SIMULATION'].includes(item.channel) ? `<a class="btn btn-whatsapp btn-sm" href="${waLink(state, waMessage)}" target="_blank" rel="noopener">Buka WhatsApp</a>` : ''}${!item.read ? `<button class="btn btn-secondary btn-sm" data-admin-action="mark-notification" data-notification-id="${esc(item.id)}">Tandai dibaca</button>` : ''}</div></div></article>`; }).join('') : '<div class="empty-state"><strong>Belum ada notifikasi</strong></div>'}</div></section>`;
  }

  function adminSettings(state) {
    const s = state.settings;
    const runtime = state.runtime || {};
    const demoControls = s.operationMode === 'PRODUCTION' ? '' : `<section class="admin-panel"><div class="panel-head"><h2>Data uji coba</h2></div><div class="notice warning">Reset hanya tersedia pada mode uji coba.</div><div style="margin-top:14px"><button class="btn btn-danger" data-admin-action="reset-demo">Reset data uji coba</button></div></section>`;
    return `${pageHeading('Pengaturan', 'Atur informasi yang dilihat pelanggan dan kelola menu PO.')}
      <section class="admin-panel"><div class="panel-head"><h2>Kelola toko</h2></div><div class="quick-actions"><button class="btn btn-primary" data-admin-page="menus">Menu makanan</button><button class="btn btn-secondary" data-admin-page="batches">Tanggal dan kuota PO</button><button class="btn btn-ghost" data-admin-page="testimonials">Testimoni</button><button class="btn btn-ghost" data-admin-action="request-browser-notification">Aktifkan notifikasi HP</button></div></section>
      <section class="admin-panel"><form id="settings-form" class="form-grid">
        <div class="field"><label>Nama usaha</label><input name="businessName" value="${esc(s.businessName)}"></div>
        <div class="field"><label>Nomor yang ditampilkan</label><input name="phone" value="${esc(s.phone)}"></div>
        <div class="field"><label>Nomor WhatsApp</label><input name="whatsappNumber" inputmode="numeric" value="${esc(s.whatsappNumber)}"><span class="help">Contoh: 6281234567890</span></div>
        <div class="field"><label>Tema tampilan</label><select name="themeDefault"><option value="light" ${s.themeDefault === 'light' ? 'selected' : ''}>Terang</option><option value="dark" ${s.themeDefault === 'dark' ? 'selected' : ''}>Gelap</option></select></div>
        <div class="field field-full"><label>Pesan pembuka WhatsApp</label><textarea name="whatsappGreeting">${esc(s.whatsappGreeting || '')}</textarea></div>
        <div class="field field-full"><label>Tagline</label><input name="tagline" value="${esc(s.tagline)}"></div>
        <div class="field"><label>Lokasi</label><input name="location" value="${esc(s.location)}"></div>
        <div class="field"><label>Jam operasional</label><input name="operationHours" value="${esc(s.operationHours)}"></div>
        <div class="field field-full"><label>Rekening untuk transfer</label><input name="bankAccount" value="${esc(s.bankAccount || '')}" placeholder="Contoh: BCA 1234567890 a.n. Rini"></div>
        <div class="field"><label>Gambar QRIS</label><input id="qris-file" type="file" accept="image/png,image/jpeg,image/webp"><span class="help">Opsional. QRIS ditampilkan kepada pelanggan setelah checkout.</span></div>
        <div class="field">${s.qrisImage ? `<label>QRIS saat ini</label><img class="qris-preview" id="qris-preview" src="${esc(s.qrisImage)}" alt="QRIS Dapur Rini">` : '<label>QRIS saat ini</label><div class="notice info" id="qris-preview">Belum ada gambar QRIS.</div>'}</div>
        <div class="field"><label>Batas pembayaran</label><div class="input-suffix"><input name="paymentTimeoutMinutes" type="number" min="5" value="${Number(s.paymentTimeoutMinutes || 60)}"><span>menit</span></div></div>
        <div class="field"><label>Pengingat sebelum habis</label><div class="input-suffix"><input name="expiryWarningMinutes" type="number" min="1" value="${Number(s.expiryWarningMinutes || 15)}"><span>menit</span></div></div>
        <div class="field field-full"><label class="check-card"><input type="checkbox" name="cashPickupEnabled" ${s.cashPickupEnabled !== false ? 'checked' : ''}><span><strong>Izinkan pembayaran tunai saat pickup</strong><small>Tidak tersedia untuk pesanan yang dikirim.</small></span></label></div>
        <div class="field field-full"><label class="check-card"><input type="checkbox" name="autoCancelUnverified" ${s.autoCancelUnverified ? 'checked' : ''}><span><strong>Lepaskan kuota otomatis saat batas pembayaran habis</strong><small>Pembayaran terlambat tetap dapat diperiksa secara manual.</small></span></label></div>
        <div class="field field-full"><label class="check-card"><input type="checkbox" name="notificationSound" ${s.notificationSound ? 'checked' : ''}><span><strong>Bunyikan pemberitahuan baru</strong><small>Browser mungkin meminta izin.</small></span></label></div>
        <div class="field field-full"><button class="btn btn-primary">Simpan pengaturan</button></div>
      </form></section>
      <section class="admin-panel"><div class="panel-head"><h2>Status sistem</h2></div><div class="summary-box"><div class="summary-row"><span>Mode</span><strong>${esc(s.operationMode || 'DEMO')}</strong></div><div class="summary-row"><span>Penyimpanan data</span><strong>${runtime.databaseDriver === 'postgres' ? 'PostgreSQL' : 'File lokal'}</strong></div><div class="summary-row"><span>Cookie aman</span><strong>${runtime.secureCookie ? 'Aktif' : 'Belum aktif'}</strong></div><div class="summary-row"><span>Sesi</span><strong>Cookie HttpOnly dan perlindungan CSRF</strong></div></div></section>
      ${demoControls}`;
  }

  function bindAdminEvents() {
    app.querySelectorAll('[data-admin-page]').forEach((button) => button.addEventListener('click', () => { activeAdminPage = button.dataset.adminPage; renderAdmin(); }));
    app.querySelectorAll('[data-admin-action]').forEach((button) => button.addEventListener('click', () => handleAdminAction(button)));
    app.querySelectorAll('[data-filter-scope][data-filter-key]').forEach((field) => {
      const eventName = field.tagName === 'INPUT' ? 'input' : 'change';
      field.addEventListener(eventName, () => {
        const scope = field.dataset.filterScope;
        const key = field.dataset.filterKey;
        const id = field.id;
        const start = typeof field.selectionStart === 'number' ? field.selectionStart : null;
        adminFilters[scope][key] = field.value;
        renderAdmin();
        if (eventName === 'input') {
          const next = document.getElementById(id);
          next?.focus();
          if (start !== null) next?.setSelectionRange(start, start);
        }
      });
    });
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) settingsForm.onsubmit = async (event) => {
      event.preventDefault();
      const submit = settingsForm.querySelector('button[type="submit"], button:not([type])');
      submit.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(settingsForm));
        data.autoCancelUnverified = settingsForm.elements.autoCancelUnverified.checked;
        data.notificationSound = settingsForm.elements.notificationSound.checked;
        data.cashPickupEnabled = settingsForm.elements.cashPickupEnabled.checked;
        const qrisFile = document.getElementById('qris-file')?.files?.[0];
        if (qrisFile) data.qrisImageData = await readFileDataUrl(qrisFile, 'Gambar QRIS');
        await Store.updateSettings(data);
        applyTheme(data.themeDefault);
        toast('Pengaturan disimpan.', 'success');
        renderAdmin();
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    };
  }

  async function handleAdminAction(button) {
    const action = button.dataset.adminAction;
    try {
      if (action === 'logout') { await Store.logout(); renderAdmin(); return; }
      if (action === 'toggle-theme') { toggleTheme(); return; }
      if (action === 'close-all') return confirmAction('Tutup semua PO?', 'Seluruh batch yang masih menerima pesanan akan ditutup. Pesanan dibayar tetap masuk produksi.', async () => { await Store.closeAllOpenBatches(); renderAdmin(); toast('Semua PO aktif telah ditutup.', 'success'); });
      if (action === 'reset-demo') return confirmReset();
      if (action === 'clear-filters') {
        const scope = button.dataset.filterScope;
        Object.keys(adminFilters[scope]).forEach((key) => { adminFilters[scope][key] = key === 'search' ? '' : 'ALL'; });
        renderAdmin();
        return;
      }
      if (action === 'verify-order') { await Store.verifyOrder(button.dataset.orderId); renderAdmin(); toast('Pembayaran diterima dan masuk produksi.', 'success'); }
      if (action === 'payment-receive') return confirmAction('Pembayaran sudah masuk?', 'Pastikan nama, nominal, dan waktu sudah cocok pada aplikasi bank atau QRIS.', async () => { await Store.reviewPayment(button.dataset.orderId, 'RECEIVE'); renderAdmin(); toast('Pembayaran diterima.', 'success'); });
      if (action === 'payment-check-later') { await Store.reviewPayment(button.dataset.orderId, 'CHECK_LATER'); renderAdmin(); toast('Pembayaran dipindahkan ke daftar Cek lagi.'); }
      if (action === 'payment-request-proof') { showPaymentRequestProof(button.dataset.orderId); return; }
      if (action === 'payment-problem') { showPaymentProblem(button.dataset.orderId); return; }
      if (action === 'payment-refunded') { showRefundConfirmation(button.dataset.orderId); return; }
      if (action === 'extend-order') { await Store.extendPaymentDeadline(button.dataset.orderId, Number(button.dataset.minutes || 15)); renderAdmin(); toast('Batas pembayaran diperpanjang.', 'success'); }
      if (action === 'reject-order') return confirmAction('Tolak pembayaran?', 'Kuota tertahan akan dikembalikan. Jika ini pemesan pembuka, batch kembali menunggu pembuka.', async () => { await Store.rejectOrExpireOrder(button.dataset.orderId, 'REJECTED'); renderAdmin(); toast('Pembayaran ditolak.'); });
      if (action === 'order-detail') showAdminOrder(button.dataset.orderId);
      if (action === 'edit-menu') showMenuForm(button.dataset.menuId);
      if (action === 'add-menu') showMenuForm();
      if (action === 'toggle-menu') { const state = Store.getState(); const menu = state.menus.find((m) => m.id === button.dataset.menuId); await Store.updateMenu(menu.id, { active: !menu.active }); renderAdmin(); }
      if (action === 'edit-batch') showBatchForm(button.dataset.batchId);
      if (action === 'add-batch') showBatchForm('', button.dataset.menuId || '');
      if (action === 'add-testimonial') showTestimonialForm();
      if (action === 'edit-testimonial') showTestimonialForm(button.dataset.testimonialId);
      if (action === 'preview-testimonial') showTestimonial(button.dataset.testimonialId);
      if (action === 'toggle-testimonial') { const state = Store.getState(); const item = state.testimonials.find((entry) => entry.id === button.dataset.testimonialId); await Store.updateTestimonial(item.id, { active: !item.active }); renderAdmin(); }
      if (action === 'delete-testimonial') return confirmAction('Hapus testimoni?', 'Screenshot testimoni akan dihapus dari tampilan demo.', async () => { await Store.deleteTestimonial(button.dataset.testimonialId); renderAdmin(); toast('Testimoni dihapus.'); });
      if (action === 'mark-notification') { await Store.markNotificationRead(button.dataset.notificationId); renderAdmin(); }
      if (action === 'mark-all-notifications') { await Store.markAllNotificationsRead(); renderAdmin(); toast('Semua notifikasi ditandai dibaca.', 'success'); }
      if (action === 'request-browser-notification') { requestBrowserNotification(); return; }
      if (action === 'test-notification') { testOwnerNotification(); return; }
      if (action === 'set-order-status') { await Store.updateOrderStatus(button.dataset.orderId, button.dataset.status); renderAdmin(); toast('Status pesanan diperbarui.', 'success'); }
      if (action === 'bulk-order-status') { await Store.bulkProductionStatus(button.dataset.status, button.dataset.deliveryDate || ''); renderAdmin(); toast('Tahap produksi diperbarui sesuai metode penerimaan.', 'success'); }
    } catch (error) { toast(error.message, 'error'); }
  }

  async function requestBrowserNotification() {
    if (!('Notification' in window)) { toast('Browser ini tidak mendukung notifikasi perangkat.', 'error'); return; }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('Dapur Rini — Notifikasi aktif', { body: 'Pesanan baru akan ditampilkan selama dashboard demo digunakan.' });
      toast('Notifikasi browser diaktifkan.', 'success');
    } else toast('Izin notifikasi belum diberikan.', 'error');
  }

  function testOwnerNotification() {
    playNotificationTone();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Dapur Rini — Pesanan Baru', { body: 'Contoh pemberitahuan: pelanggan memesan Paket Ayam Bakar sebanyak 10 porsi.' });
    }
    toast('Uji notifikasi dashboard dijalankan.', 'success');
  }

  function showTestimonialForm(testimonialId = '') {
    const state = Store.getState();
    const item = state.testimonials.find((entry) => entry.id === testimonialId);
    const defaultImage = item?.image || 'assets/images/testimoni.webp';
    openModal(`<form id="testimonial-form"><div class="modal-header"><div><h2>${item ? 'Edit testimoni' : 'Tambah testimoni'}</h2><div class="help">Screenshot WhatsApp akan ditampilkan pada landing page.</div></div><button type="button" class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="testimonial-form-preview"><img id="testimonial-preview" src="${esc(defaultImage)}" alt="Pratinjau screenshot testimoni"></div><div class="form-grid"><div class="field"><label>Nama / inisial</label><input name="name" required value="${esc(item?.name || '')}" placeholder="Contoh: Maya ••••"></div><div class="field"><label>Menu yang dipesan</label><input name="menuName" required value="${esc(item?.menuName || '')}" placeholder="Paket Ayam Bakar"></div><div class="field field-full"><label>Caption singkat</label><input name="caption" value="${esc(item?.caption || '')}" placeholder="Bumbu meresap dan sambalnya pas."></div><div class="field"><label>Urutan tampil</label><input name="sortOrder" type="number" min="1" value="${Number(item?.sortOrder || state.testimonials.length + 1)}"></div><div class="field"><label>Screenshot WhatsApp</label><input id="testimonial-file" type="file" accept="image/*"><span class="help">Opsional. Gunakan gambar yang jelas dan sudah disamarkan.</span></div></div><input type="hidden" name="image" id="testimonial-image-value" value="${esc(defaultImage)}"><div class="notice warning" style="margin-top:14px">Pastikan nomor telepon, alamat, dan informasi pembayaran telah disamarkan.</div></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-primary">Simpan testimoni</button></div></form>`, true);
    const fileInput = document.getElementById('testimonial-file');
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) { toast('Ukuran screenshot maksimal 1,5 MB.', 'error'); fileInput.value = ''; return; }
      const reader = new FileReader();
      reader.onload = () => { document.getElementById('testimonial-image-value').value = reader.result; document.getElementById('testimonial-preview').src = reader.result; };
      reader.readAsDataURL(file);
    };
    document.getElementById('testimonial-form').onsubmit = async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      data.sortOrder = Number(data.sortOrder || 1);
      if (String(data.image || '').startsWith('data:')) { data.imageData = data.image; delete data.image; }
      const submit = event.currentTarget.querySelector('button[type="submit"], button:not([type])');
      submit.disabled = true;
      try {
        if (item) await Store.updateTestimonial(item.id, data); else await Store.addTestimonial(data);
        closeModal(); renderAdmin(); toast('Testimoni disimpan.', 'success');
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    };
  }

  function confirmAction(title, text, callback) {
    openModal(`<div class="modal-header"><h2>${esc(title)}</h2><button class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="notice danger">${esc(text)}</div></div><div class="modal-footer"><button class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-danger" id="confirm-action">Ya, lanjutkan</button></div>`);
    const confirmButton = document.getElementById('confirm-action');
    confirmButton.onclick = async () => { confirmButton.disabled = true; try { await callback(); closeModal(); } catch (error) { toast(error.message, 'error'); confirmButton.disabled = false; } };
  }

  function confirmReset() {
    openModal(`<div class="modal-header"><h2>Reset data demo</h2><button class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="notice danger"><strong>Konfirmasi dua langkah.</strong><br>Semua perubahan, pesanan baru, dan status yang diuji akan dikembalikan ke data awal.</div><div class="field" style="margin-top:16px"><label>Ketik RESET RINI</label><input id="reset-confirm" autocomplete="off"></div></div><div class="modal-footer"><button class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-danger" id="reset-final" disabled>Reset sekarang</button></div>`);
    const input = document.getElementById('reset-confirm'); const final = document.getElementById('reset-final');
    input.oninput = () => { final.disabled = input.value.trim() !== 'RESET RINI'; };
    final.onclick = async () => { final.disabled = true; try { await Store.reset(); closeModal(); activeAdminPage = 'dashboard'; renderAdmin(); toast('Data demo dibuat ulang dari waktu server saat ini.', 'success'); } catch (error) { toast(error.message, 'error'); final.disabled = false; } };
  }

  function showPaymentRequestProof(orderId) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    openModal(`<form id="request-proof-form"><div class="modal-header"><h2>Minta bukti baru</h2><button type="button" class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="field"><label>Alasan</label><select name="reason"><option>Bukti tidak jelas</option><option>Nominal tidak terlihat</option><option>Nama pengirim tidak terlihat</option><option>Waktu pembayaran tidak terlihat</option><option>Bukti tidak sesuai dengan pesanan</option></select></div><div class="notice info" style="margin-top:14px">Setelah disimpan, tombol WhatsApp akan membuka pesan yang sudah disiapkan.</div></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-primary">Simpan dan hubungi</button></div></form>`);
    document.getElementById('request-proof-form').onsubmit = async (event) => {
      event.preventDefault();
      const reason = event.currentTarget.elements.reason.value;
      const submit = event.currentTarget.querySelector('button[type="submit"], button:not([type])');
      submit.disabled = true;
      try {
        await Store.reviewPayment(order.id, 'REQUEST_NEW_PROOF', { reason });
        const message = `Halo ${order.customerName}, bukti pembayaran untuk pesanan ${order.code} perlu diunggah ulang karena ${reason.toLowerCase()}. Silakan buka halaman lacak pesanan dan unggah foto baru.`;
        closeModal(); renderAdmin();
        window.open(waCustomerLink(order.phone, message), '_blank', 'noopener');
        toast('Pesanan dipindahkan ke Minta bukti baru.', 'success');
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    };
  }

  function showPaymentProblem(orderId) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    openModal(`<form id="payment-problem-form"><div class="modal-header"><h2>Masalah pembayaran</h2><button type="button" class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="form-grid"><div class="field field-full"><label>Masalah yang ditemukan</label><select name="reason"><option>Pembayaran kurang</option><option>Pembayaran lebih</option><option>Nama pengirim berbeda</option><option>Transaksi tidak ditemukan</option><option>Pembayaran masuk setelah pesanan kedaluwarsa</option></select></div><div class="field field-full"><label>Tindakan</label><select name="decision"><option value="REQUEST_NEW_PROOF">Minta bukti atau penjelasan baru</option><option value="REJECT">Batalkan pesanan</option><option value="REFUND_REQUIRED">Dana perlu dikembalikan</option></select></div><div class="field field-full"><label>Catatan tambahan</label><textarea name="note" maxlength="220" placeholder="Opsional"></textarea></div></div></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-primary">Simpan keputusan</button></div></form>`);
    document.getElementById('payment-problem-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"], button:not([type])');
      submit.disabled = true;
      const reason = `${form.elements.reason.value}${form.elements.note.value.trim() ? `. ${form.elements.note.value.trim()}` : ''}`;
      const decision = form.elements.decision.value;
      try {
        await Store.reviewPayment(order.id, decision, { reason, amount: order.reportedAmount || order.total });
        closeModal(); renderAdmin(); toast('Keputusan pembayaran disimpan.', 'success');
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    };
  }

  function showRefundConfirmation(orderId) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    openModal(`<form id="refund-confirm-form"><div class="modal-header"><h2>Dana sudah dikembalikan?</h2><button type="button" class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="summary-box"><div class="summary-row"><span>Pesanan</span><strong>${esc(order.code)}</strong></div><div class="summary-row"><span>Jumlah</span><strong>${rupiah(order.refundAmount || order.total)}</strong></div><div class="summary-row"><span>Alasan</span><strong>${esc(order.refundReason || '-')}</strong></div></div><div class="field" style="margin-top:14px"><label>Catatan pengembalian</label><textarea name="note" maxlength="300" placeholder="Contoh: transfer kembali melalui BCA pukul 14.20"></textarea></div></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-success">Ya, dana sudah dikembalikan</button></div></form>`);
    document.getElementById('refund-confirm-form').onsubmit = async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"], button:not([type])');
      submit.disabled = true;
      try {
        await Store.confirmRefund(order.id, { note: event.currentTarget.elements.note.value });
        closeModal(); renderAdmin(); toast('Pengembalian dana dicatat.', 'success');
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    };
  }

  function showAdminOrder(orderId) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    const canReview = ['PENDING_REVIEW', 'LATE_PAYMENT_REVIEW', 'CHECK_LATER'].includes(order.paymentStatus);
    const canRequestProof = ['PENDING_REVIEW', 'LATE_PAYMENT_REVIEW', 'CHECK_LATER', 'NEED_NEW_PROOF'].includes(order.paymentStatus);
    const canUpload = ['UNPAID', 'NEED_NEW_PROOF', 'EXPIRED'].includes(order.paymentStatus) && order.paymentMethod !== 'CASH_PICKUP';
    const needsRefund = order.paymentStatus === 'REFUND_PENDING';
    const customerMessage = order.paymentStatus === 'NEED_NEW_PROOF'
      ? `Halo ${order.customerName}, bukti pembayaran untuk pesanan ${order.code} perlu diunggah ulang. ${order.reviewReason || ''}`
      : `Halo ${order.customerName}, kami ingin mengonfirmasi pesanan ${order.code}. Status pembayaran saat ini: ${paymentLabel[order.paymentStatus] || order.paymentStatus}.`;
    const proof = order.proofKey
      ? `<div class="payment-proof-panel"><span>Bukti pembayaran</span><a href="/api/proofs/${encodeURIComponent(order.proofKey)}" target="_blank" rel="noopener"><img src="/api/proofs/${encodeURIComponent(order.proofKey)}" alt="Bukti pembayaran ${esc(order.code)}"></a><small>Tekan gambar untuk membuka ukuran penuh.</small></div>`
      : '<div class="notice info">Belum ada bukti pembayaran yang dapat dilihat.</div>';
    const deadline = order.paymentDeadline && !['PAID', 'REFUNDED'].includes(order.paymentStatus)
      ? `<div class="payment-deadline-card"><span>Batas pembayaran</span><strong data-payment-countdown="${esc(order.paymentDeadline)}">${paymentRemainingText(order.paymentDeadline)}</strong><small>${dateTime(order.paymentDeadline)}</small></div>` : '';
    openModal(`<div class="modal-header"><div><h2>${esc(order.code)}</h2><div class="help">Dibuat ${dateTime(order.createdAt)}</div></div><button type="button" class="close-btn" data-modal-close aria-label="Tutup dialog">×</button></div><div class="modal-body">
      ${deadline}
      ${order.paymentStatus === 'EXPIRED' ? '<div class="notice danger">Batas pembayaran sudah lewat dan kuota telah dilepas. Pembayaran terlambat harus diperiksa sebelum pesanan dipulihkan.</div>' : ''}
      ${order.reviewReason ? `<div class="notice warning"><strong>Catatan pemeriksaan</strong><br>${esc(order.reviewReason)}</div>` : ''}
      <div class="form-grid"><div class="field"><label>Pelanggan</label><div>${esc(order.customerName)}<br>${esc(order.phone)}</div></div><div class="field"><label>Penerimaan</label><div>${order.fulfillment === 'PICKUP' ? 'Ambil sendiri' : 'Dikirim'}</div></div><div class="field field-full"><label>Alamat / catatan</label><div>${esc(order.address || '-')}<br>${esc(order.note || '-')}</div></div></div>
      <div class="cart-list" style="margin-top:16px">${order.items.map((item) => `<div class="cart-item"><div class="cart-thumb"><img src="${esc(itemImage(item, state))}" alt=""></div><div><h4>${esc(item.name)}</h4><small>${item.qty} ${esc(item.unit)} × ${rupiah(item.price)}</small></div><strong>${rupiah(item.subtotal)}</strong></div>`).join('')}</div>
      <div class="summary-box"><div class="summary-row"><span>Status pembayaran</span><strong>${paymentLabel[order.paymentStatus] || esc(order.paymentStatus)}</strong></div><div class="summary-row"><span>Metode pembayaran</span><strong>${paymentMethodLabel[order.paymentMethod] || esc(order.paymentMethod)}</strong></div><div class="summary-row"><span>Nama pengirim</span><strong>${esc(order.reportedSenderName || '-')}</strong></div><div class="summary-row"><span>Nominal dilaporkan</span><strong>${order.reportedAmount ? rupiah(order.reportedAmount) : '-'}</strong></div><div class="summary-row"><span>Waktu dilaporkan</span><strong>${order.reportedPaidAt ? dateTime(order.reportedPaidAt) : '-'}</strong></div><div class="summary-row"><span>Status pesanan</span><strong>${orderLabel[order.orderStatus] || esc(order.orderStatus)}</strong></div>${needsRefund ? `<div class="summary-row"><span>Dana dikembalikan</span><strong>${rupiah(order.refundAmount || order.total)}</strong></div>` : ''}<div class="summary-row total"><span>Total pesanan</span><strong>${rupiah(order.total)}</strong></div></div>
      <div style="margin-top:16px">${proof}</div>
      ${canUpload ? '<div class="notice info" style="margin-top:14px">Pelanggan dapat mengunggah bukti melalui halaman pelacakan pesanan.</div>' : ''}
    </div><div class="modal-footer"><a class="btn btn-whatsapp" href="${waCustomerLink(order.phone, customerMessage)}" target="_blank" rel="noopener">Hubungi pelanggan</a><button class="btn btn-ghost" data-modal-close>Tutup</button>${canReview ? `<button class="btn btn-secondary" id="modal-check-later">Belum masuk</button><button class="btn btn-success" id="modal-receive">Pembayaran diterima</button>` : ''}${canRequestProof ? '<button class="btn btn-warning" id="modal-request-proof">Minta bukti baru</button>' : ''}${needsRefund ? '<button class="btn btn-success" id="modal-refunded">Dana sudah dikembalikan</button>' : ''}</div>`, true);
    const receive = document.getElementById('modal-receive');
    if (receive) receive.onclick = () => confirmAction('Pembayaran sudah masuk?', 'Pastikan nama, nominal, dan waktu sudah cocok pada aplikasi bank atau QRIS.', async () => { await Store.reviewPayment(order.id, 'RECEIVE'); closeModal(); renderAdmin(); toast('Pembayaran diterima.', 'success'); });
    const checkLater = document.getElementById('modal-check-later');
    if (checkLater) checkLater.onclick = async () => { try { await Store.reviewPayment(order.id, 'CHECK_LATER'); closeModal(); renderAdmin(); toast('Pembayaran dipindahkan ke daftar Cek lagi.'); } catch (error) { toast(error.message, 'error'); } };
    const requestProof = document.getElementById('modal-request-proof');
    if (requestProof) requestProof.onclick = () => showPaymentRequestProof(order.id);
    const refunded = document.getElementById('modal-refunded');
    if (refunded) refunded.onclick = () => showRefundConfirmation(order.id);
    startCountdowns();
  }

  function showMenuForm(menuId = '') {
    const state = Store.getState(); const menu = state.menus.find((m) => m.id === menuId);
    const imageOptions = [
      ['assets/images/ayam-bakar.webp', 'Foto Ayam Bakar'],
      ['assets/images/ayam-serundeng.webp', 'Foto Ayam Serundeng'],
      ['assets/images/ayam-geprek.webp', 'Foto Ayam Geprek'],
      ['assets/images/ayam-kremes.webp', 'Foto Ayam Kremes'],
      ['assets/images/nasi-liwet.webp', 'Foto Nasi Liwet'],
      ['assets/images/nasi-kuning.webp', 'Foto Nasi Kuning'],
      ['assets/images/nasi-uduk.webp', 'Foto Nasi Uduk'],
      ['assets/images/ikan-bakar.webp', 'Foto Ikan Bakar'],
      ['assets/images/lele-goreng.webp', 'Foto Lele Goreng'],
      ['assets/images/telur-balado.webp', 'Foto Telur Balado'],
      ['assets/images/donat-gula.webp', 'Foto Donat Gula'],
      ['assets/images/donat-meses.webp', 'Foto Donat Cokelat Meses'],
      ['assets/images/donat-topping.webp', 'Foto Donat Topping'],
      ['assets/images/bugis-ketan-v4.webp', 'Foto Bugis Ketan'],
      ['assets/images/nagasari.webp', 'Foto Nagasari'],
      ['assets/images/bolen-cokelat.webp', 'Foto Bolen Cokelat'],
      ['assets/images/bolu-pisang.webp', 'Foto Bolu Pisang'],
      ['assets/images/risoles.webp', 'Foto Risoles'],
      ['assets/images/lemper.webp', 'Foto Lemper'],
      ['assets/images/snack-box.webp', 'Foto Snack Box']
    ];
    const selectedImage = menuImage(menu);
    openModal(`<form id="menu-form"><div class="modal-header"><h2>${menu ? 'Edit menu' : 'Tambah menu'}</h2><button type="button" class="close-btn" data-modal-close>×</button></div><div class="modal-body"><div class="menu-photo-preview"><img id="menu-photo-preview" src="${esc(selectedImage)}" alt="Pratinjau foto menu"></div><div class="form-grid"><div class="field field-full"><label>Nama menu</label><input name="name" required value="${esc(menu?.name || '')}"></div><div class="field"><label>Kategori</label><input name="category" required value="${esc(menu?.category || 'Paket Nasi')}"></div><div class="field"><label>Foto pilihan</label><select name="image" id="menu-image-select">${imageOptions.map(([value,label]) => `<option value="${esc(value)}" ${selectedImage === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div><div class="field"><label>Harga</label><input name="price" required type="number" min="0" value="${menu?.price || 25000}"></div><div class="field"><label>Satuan</label><input name="unit" required value="${esc(menu?.unit || 'porsi')}"></div><div class="field"><label>Minimum pembuka</label><input name="openerMin" required type="number" min="1" value="${menu?.openerMin || 10}"></div><div class="field"><label>Kapasitas</label><input name="capacity" required type="number" min="1" value="${menu?.defaultCapacity || 50}"></div><div class="field"><label>Urutan menu</label><input name="sortOrder" required type="number" min="1" value="${Number(menu?.sortOrder || state.menus.length + 1)}"></div><div class="field field-full"><label>Deskripsi</label><textarea name="description" required>${esc(menu?.description || '')}</textarea></div></div></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-primary">Simpan menu</button></div></form>`, true);
    const imageSelect = document.getElementById('menu-image-select');
    imageSelect.onchange = () => { document.getElementById('menu-photo-preview').src = imageSelect.value; };
    document.getElementById('menu-form').onsubmit = async (event) => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
      const submit = event.currentTarget.querySelector('button[type="submit"], button:not([type])');
      submit.disabled = true;
      const patch = { ...data, price: Number(data.price), openerMin: Number(data.openerMin), defaultCapacity: Number(data.capacity), sortOrder: Number(data.sortOrder), imageAlt: `Foto pilihan ${data.name}` };
      try {
        if (menu) await Store.updateMenu(menu.id, patch); else await Store.addMenu({ ...data, capacity: Number(data.capacity), sortOrder: Number(data.sortOrder) });
        closeModal(); renderAdmin(); toast('Menu disimpan.', 'success');
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    };
  }

  function showBatchForm(batchId = '', menuId = '') {
    const state = Store.getState();
    const batch = state.batches.find((item) => item.id === batchId) || null;
    const selectedMenuId = batch?.menuId || menuId || state.menus.find((item) => item.active)?.id || state.menus[0]?.id;
    const menu = state.menus.find((item) => item.id === selectedMenuId);
    if (!menu) { toast('Menu belum tersedia.', 'error'); return; }
    const now = Date.now();
    const model = batch || {
      status: 'DRAFT', price: menu.price, openerMin: menu.openerMin, capacity: menu.defaultCapacity,
      soldQty: 0, heldQty: 0, closesAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      deliveryAt: new Date(now + 48 * 60 * 60 * 1000).toISOString()
    };
    const statuses = ['DRAFT', 'SCHEDULED', 'WAITING_OPENER', 'OPEN', 'CLOSING_SOON', 'SOLD_OUT', 'CLOSED', 'CANCELLED', 'IN_PRODUCTION', 'READY', 'COMPLETED'];
    const menuField = batch
      ? `<div class="field field-full"><label>Menu</label><input value="${esc(menu.name)}" disabled></div>`
      : `<div class="field field-full"><label>Menu</label><select name="menuId">${state.menus.map((item) => `<option value="${esc(item.id)}" ${item.id === selectedMenuId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></div>`;
    openModal(`<form id="batch-form"><div class="modal-header"><div><h2>${batch ? 'Atur batch PO' : 'Buat batch PO baru'}</h2><div class="help">${batch ? esc(menu.name) : 'Satu menu dapat memiliki beberapa tanggal PO.'}</div></div><button type="button" class="close-btn" data-modal-close aria-label="Tutup dialog">×</button></div><div class="modal-body"><div class="form-grid">${menuField}<div class="field"><label>Status</label><select name="status">${statuses.map((status) => `<option value="${status}" ${status === model.status ? 'selected' : ''}>${batchLabel[status]?.[0] || status}</option>`).join('')}</select></div><div class="field"><label>Harga batch</label><input name="price" type="number" min="0" required value="${model.price}"></div><div class="field"><label>Minimum pembuka</label><input name="openerMin" type="number" min="1" required value="${model.openerMin}"></div><div class="field"><label>Kapasitas</label><input name="capacity" type="number" min="${Number(model.soldQty || 0) + Number(model.heldQty || 0) || 1}" required value="${model.capacity}"></div><div class="field field-full"><label>Waktu tutup WIB</label><input name="closesAt" type="datetime-local" required value="${toJakartaLocalInput(model.closesAt)}"></div><div class="field field-full"><label>Waktu pengiriman WIB</label><input name="deliveryAt" type="datetime-local" required value="${toJakartaLocalInput(model.deliveryAt)}"></div></div><div class="notice info" style="margin-top:14px">${batch ? `Terjual ${batch.soldQty}, tertahan ${batch.heldQty}, sisa ${Store.availableQty(batch)} ${esc(menu.unit)}.` : 'Waktu disimpan dan dihitung secara konsisten menggunakan zona Asia/Jakarta.'}</div></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Batal</button><button class="btn btn-primary">${batch ? 'Simpan batch' : 'Buat batch'}</button></div></form>`);
    document.getElementById('batch-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      const submit = form.querySelector('button[type="submit"], button:not([type])');
      submit.disabled = true;
      try {
        const payload = { status: data.status, price: Number(data.price), openerMin: Number(data.openerMin), capacity: Number(data.capacity), closesAt: fromJakartaLocalInput(data.closesAt), deliveryAt: fromJakartaLocalInput(data.deliveryAt) };
        if (batch) await Store.updateBatch(batch.id, payload);
        else await Store.addBatch({ ...payload, menuId: data.menuId, opensAt: new Date().toISOString() });
        closeModal();
        renderAdmin();
        toast(batch ? 'Batch PO diperbarui.' : 'Batch PO baru dibuat.', 'success');
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    };
  }

  let stateSyncTimer = null;
  function syncFromSharedState() {
    clearTimeout(stateSyncTimer);
    stateSyncTimer = setTimeout(() => {
      const y = window.scrollY;
      if (isAdminRoute && Store.isLoggedIn()) {
        const state = Store.getState();
        const unread = state.notifications.filter((item) => !item.read).length;
        if (previousUnreadCount !== null && unread > previousUnreadCount) {
          if (state.settings.notificationSound) playNotificationTone();
          const newest = state.notifications.find((item) => !item.read);
          if (newest) toast(newest.title, 'success');
          if (newest && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`Dapur Rini — ${newest.title}`, { body: newest.message });
          }
        }
        renderAdmin();
      } else if (!isAdminRoute) {
        renderCustomer();
      }
      requestAnimationFrame(() => window.scrollTo(0, y));
    }, 40);
  }

  window.addEventListener('dapur-rini-state-changed', syncFromSharedState);
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY) { applyTheme(event.newValue || 'light'); if (isAdminRoute) renderAdmin(); else renderCustomer(); }
  });

  async function bootstrap() {
    try {
      await Store.init();
      if (isAdminRoute) renderAdmin(); else renderCustomer();
      setInterval(async () => {
        const before = Number(Store.getState().stateRevision || 0);
        try {
          await Store.refresh();
          const after = Number(Store.getState().stateRevision || 0);
          if (after !== before || (isAdminRoute && !Store.isLoggedIn())) syncFromSharedState();
        } catch (_) {}
      }, 5000);
    } catch (error) {
      app.innerHTML = `<main class="login-page"><section class="login-card"><h1>Gagal Memuat Aplikasi</h1><p>${esc(error.message)}</p><div class="notice danger">Gagal terhubung ke server backend Vercel. Pastikan koneksi internet stabil dan backend Vercel + Supabase sudah aktif.</div></section></main>`;
    }
  }

  bootstrap();
})();
