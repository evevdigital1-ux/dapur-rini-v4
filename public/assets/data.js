(function () {
  'use strict';

  const money = (value) => Number(value || 0);
  const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

  function jakartaDateParts(date) {
    const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth(),
      day: shifted.getUTCDate()
    };
  }

  function jakartaIso(baseDate, daysFromNow, hour, minute = 0) {
    const parts = jakartaDateParts(baseDate);
    return new Date(Date.UTC(parts.year, parts.month, parts.day + daysFromNow, hour - 7, minute, 0, 0)).toISOString();
  }

  function createSeed(inputNow = new Date()) {
    const now = inputNow instanceof Date ? new Date(inputNow.getTime()) : new Date(inputNow);
    if (Number.isNaN(now.getTime())) throw new Error('Waktu seed tidak valid.');
    const closeAt = (hoursFromNow) => new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000).toISOString();
    const deliveryAt = (daysFromNow, hour) => jakartaIso(now, daysFromNow, hour);

    const menuSeed = [
      ['menu-001', 'Paket Ayam Bakar Komplet', 'Paket Nasi', 25000, 'porsi', 10, 50, '🍗', 'Nasi putih, ayam bakar bumbu kecap, tahu atau tempe, lalapan, dan sambal rumahan.'],
      ['menu-002', 'Paket Ayam Goreng Serundeng', 'Paket Nasi', 24000, 'porsi', 10, 50, '🍗', 'Ayam goreng gurih dengan serundeng kelapa, nasi putih, lalapan, dan sambal.'],
      ['menu-003', 'Paket Ayam Geprek Sambal Bawang', 'Paket Nasi', 22000, 'porsi', 10, 60, '🌶️', 'Ayam crispy geprek, sambal bawang, nasi putih, serta timun segar.'],
      ['menu-004', 'Paket Ayam Kremes', 'Paket Nasi', 24000, 'porsi', 10, 50, '🍗', 'Ayam goreng kremes, nasi putih, tahu, lalapan, dan sambal.'],
      ['menu-005', 'Paket Nasi Liwet Ayam Suwir', 'Paket Nasi', 27000, 'porsi', 10, 40, '🍚', 'Nasi liwet gurih dengan ayam suwir, telur, teri, lalapan, dan sambal.'],
      ['menu-006', 'Paket Nasi Kuning Komplet', 'Paket Nasi', 23000, 'box', 15, 60, '🍱', 'Nasi kuning, ayam suwir, telur balado, bihun, orek tempe, dan kerupuk.'],
      ['menu-007', 'Paket Nasi Uduk Komplet', 'Paket Nasi', 22000, 'box', 15, 60, '🍱', 'Nasi uduk, ayam goreng, bihun, telur iris, orek tempe, dan sambal kacang.'],
      ['menu-008', 'Paket Ikan Bakar Sambal Kecap', 'Paket Nasi', 28000, 'porsi', 10, 40, '🐟', 'Ikan bakar, nasi putih, lalapan, dan sambal kecap pedas manis.'],
      ['menu-009', 'Paket Lele Goreng Sambal Lalapan', 'Paket Nasi', 20000, 'porsi', 10, 50, '🐟', 'Lele goreng renyah, nasi putih, tahu atau tempe, lalapan, dan sambal.'],
      ['menu-010', 'Paket Telur Balado dan Orek Tempe', 'Paket Nasi', 18000, 'porsi', 10, 50, '🥚', 'Nasi putih, telur balado, orek tempe, sayur, dan kerupuk.'],
      ['menu-011', 'Donat Gula Halus', 'Donat', 30000, 'kotak isi 6', 2, 20, '🍩', 'Donat empuk dengan taburan gula halus, satu kotak berisi enam buah.'],
      ['menu-012', 'Donat Cokelat Meses', 'Donat', 36000, 'kotak isi 6', 2, 20, '🍩', 'Donat lembut dengan lapisan cokelat dan meses, satu kotak berisi enam buah.'],
      ['menu-013', 'Donat Aneka Topping', 'Donat', 42000, 'kotak isi 6', 2, 20, '🍩', 'Donat aneka rasa dan topping, satu kotak berisi enam buah.'],
      ['menu-014', 'Kue Bugis Ketan Hitam', 'Jajanan Tradisional', 4000, 'buah', 20, 100, '🟣', 'Kue bugis ketan hitam lembut dengan isian kelapa manis.'],
      ['menu-015', 'Nagasari Pisang', 'Jajanan Tradisional', 4000, 'buah', 20, 100, '🍌', 'Nagasari tepung beras dengan pisang matang dan aroma daun pandan.'],
      ['menu-016', 'Pisang Bolen Cokelat', 'Kue', 40000, 'kotak isi 8', 2, 20, '🥐', 'Bolen renyah berisi pisang dan cokelat, satu kotak berisi delapan buah.'],
      ['menu-017', 'Bolu Pisang Panggang', 'Kue', 45000, 'loyang', 2, 12, '🍰', 'Bolu pisang panggang yang lembut, harum, dan tidak terlalu manis.'],
      ['menu-018', 'Risoles Ragout Ayam', 'Snack', 5000, 'buah', 20, 100, '🥟', 'Risoles renyah berisi ragout ayam dan sayuran.'],
      ['menu-019', 'Lemper Ayam', 'Jajanan Tradisional', 4500, 'buah', 20, 100, '🍙', 'Ketan gurih dengan isian ayam suwir berbumbu.'],
      ['menu-020', 'Snack Box Tiga Macam', 'Snack Box', 15000, 'box', 10, 80, '🧁', 'Satu kue manis, satu snack gurih, satu jajanan tradisional, dan air mineral opsional.']
    ];

    const menuImages = {
      'menu-001': 'assets/images/ayam-bakar.webp',
      'menu-002': 'assets/images/ayam-serundeng.webp',
      'menu-003': 'assets/images/ayam-geprek.webp',
      'menu-004': 'assets/images/ayam-kremes.webp',
      'menu-005': 'assets/images/nasi-liwet.webp',
      'menu-006': 'assets/images/nasi-kuning.webp',
      'menu-007': 'assets/images/nasi-uduk.webp',
      'menu-008': 'assets/images/ikan-bakar.webp',
      'menu-009': 'assets/images/lele-goreng.webp',
      'menu-010': 'assets/images/telur-balado.webp',
      'menu-011': 'assets/images/donat-gula.webp',
      'menu-012': 'assets/images/donat-meses.webp',
      'menu-013': 'assets/images/donat-topping.webp',
      'menu-014': 'assets/images/bugis-ketan.webp',
      'menu-015': 'assets/images/nagasari.webp',
      'menu-016': 'assets/images/bolen-cokelat.webp',
      'menu-017': 'assets/images/bolu-pisang.webp',
      'menu-018': 'assets/images/risoles.webp',
      'menu-019': 'assets/images/lemper.webp',
      'menu-020': 'assets/images/snack-box.webp'
    };

    const menus = menuSeed.map((row, index) => ({
      id: row[0],
      name: row[1],
      category: row[2],
      price: money(row[3]),
      unit: row[4],
      openerMin: row[5],
      regularMin: 1,
      defaultCapacity: row[6],
      icon: row[7],
      image: menuImages[row[0]],
      imageAlt: `Foto demo ${row[1]}`,
      description: row[8],
      featured: index < 6 || [10, 13, 19].includes(index),
      active: true,
      isDemo: true
    }));

    const batchStates = [
      ['batch-001', 'menu-001', 'OPEN', 24, 0, 50, 6],
      ['batch-002', 'menu-002', 'WAITING_OPENER', 0, 0, 50, 7],
      ['batch-003', 'menu-003', 'CLOSING_SOON', 42, 0, 60, 2],
      ['batch-004', 'menu-004', 'OPENER_PENDING_PAYMENT', 0, 10, 50, 8],
      ['batch-005', 'menu-005', 'SOLD_OUT', 40, 0, 40, 5],
      ['batch-006', 'menu-006', 'OPEN', 32, 0, 60, 7],
      ['batch-007', 'menu-007', 'WAITING_OPENER', 0, 0, 60, 8],
      ['batch-008', 'menu-008', 'OPEN', 17, 0, 40, 7],
      ['batch-009', 'menu-009', 'OPEN', 21, 0, 50, 6],
      ['batch-010', 'menu-010', 'WAITING_OPENER', 0, 0, 50, 8],
      ['batch-011', 'menu-011', 'OPEN', 8, 0, 20, 5],
      ['batch-012', 'menu-012', 'WAITING_OPENER', 0, 0, 20, 7],
      ['batch-013', 'menu-013', 'OPEN', 9, 0, 20, 4],
      ['batch-014', 'menu-014', 'WAITING_OPENER', 0, 0, 100, 3],
      ['batch-015', 'menu-015', 'OPEN', 44, 0, 100, 6],
      ['batch-016', 'menu-016', 'OPEN', 7, 0, 20, 7],
      ['batch-017', 'menu-017', 'CLOSED', 8, 0, 12, -1],
      ['batch-018', 'menu-018', 'WAITING_OPENER', 0, 0, 100, 8],
      ['batch-019', 'menu-019', 'OPEN', 54, 0, 100, 5],
      ['batch-020', 'menu-020', 'OPEN', 35, 0, 80, 4]
    ];

    const batches = batchStates.map((row) => {
      const menu = menus.find((item) => item.id === row[1]);
      return {
        id: row[0],
        menuId: row[1],
        status: row[2],
        soldQty: row[3],
        heldQty: row[4],
        capacity: row[5],
        openerMin: menu.openerMin,
        regularMin: menu.regularMin,
        price: menu.price,
        opensAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        closesAt: closeAt(row[6]),
        deliveryAt: deliveryAt(1, 10),
        deliveryEndAt: deliveryAt(1, 14),
        openerOrderId: row[2] === 'OPENER_PENDING_PAYMENT' ? 'order-004' : null,
        isDemo: true
      };
    });

    const orders = [
      {
        id: 'order-001', code: 'DR-DEMO-0001', customerName: 'Siti Rahma', phone: '0812-1111-2233',
        fulfillment: 'LALAMOVE', address: 'Kalideres, Jakarta Barat', note: 'Patokan dekat minimarket.',
        paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PAID', orderStatus: 'CONFIRMED',
        createdAt: new Date(now.getTime() - 1000 * 60 * 140).toISOString(),
        deliveryAt: deliveryAt(1, 10), isOpener: true, isDemo: true,
        items: [{ menuId: 'menu-001', batchId: 'batch-001', name: 'Paket Ayam Bakar Komplet', qty: 10, unit: 'porsi', price: 25000, subtotal: 250000 }],
        subtotal: 250000, deliveryFee: 18000, total: 268000, proofName: 'bukti-transfer-siti.jpg', proofKey: '', proofMime: 'image/jpeg', proofUploadedAt: new Date(now.getTime() - 1000 * 60 * 135).toISOString(), reportedSenderName: 'Siti Rahma', reportedAmount: 268000, reportedPaidAt: new Date(now.getTime() - 1000 * 60 * 135).toISOString(), reviewReason: '', refundStatus: 'NONE'
      },
      {
        id: 'order-002', code: 'DR-DEMO-0002', customerName: 'Budi Santoso', phone: '0813-2222-3344',
        fulfillment: 'PICKUP', address: '', note: '', paymentMethod: 'QRIS_STATIC', paymentStatus: 'PAID', orderStatus: 'CONFIRMED',
        createdAt: new Date(now.getTime() - 1000 * 60 * 100).toISOString(), deliveryAt: deliveryAt(1, 10), isOpener: false, isDemo: true,
        items: [{ menuId: 'menu-001', batchId: 'batch-001', name: 'Paket Ayam Bakar Komplet', qty: 2, unit: 'porsi', price: 25000, subtotal: 50000 }],
        subtotal: 50000, deliveryFee: 0, total: 50000, proofName: 'qris-budi.png', proofKey: '', proofMime: 'image/png', proofUploadedAt: new Date(now.getTime() - 1000 * 60 * 95).toISOString(), reportedSenderName: 'Budi Santoso', reportedAmount: 50000, reportedPaidAt: new Date(now.getTime() - 1000 * 60 * 95).toISOString(), reviewReason: '', refundStatus: 'NONE'
      },
      {
        id: 'order-003', code: 'DR-DEMO-0003', customerName: 'Nabila Putri', phone: '0856-3333-4455',
        fulfillment: 'LALAMOVE', address: 'Kembangan, Jakarta Barat', note: '', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PENDING_REVIEW', orderStatus: 'WAITING_PAYMENT',
        createdAt: new Date(now.getTime() - 1000 * 60 * 55).toISOString(), deliveryAt: deliveryAt(1, 10), isOpener: false, isDemo: true,
        items: [{ menuId: 'menu-013', batchId: 'batch-013', name: 'Donat Aneka Topping', qty: 2, unit: 'kotak isi 6', price: 42000, subtotal: 84000 }],
        subtotal: 84000, deliveryFee: 16000, total: 100000, proofName: 'bukti-nabila.jpg', proofKey: '', proofMime: 'image/jpeg', proofUploadedAt: new Date(now.getTime() - 1000 * 60 * 50).toISOString(), reportedSenderName: 'Nabila Putri', reportedAmount: 100000, reportedPaidAt: new Date(now.getTime() - 1000 * 60 * 50).toISOString(), reviewReason: '', refundStatus: 'NONE'
      },
      {
        id: 'order-004', code: 'DR-DEMO-0004', customerName: 'Ahmad Fauzi', phone: '0877-4444-5566',
        fulfillment: 'PICKUP', address: '', note: 'Ambil pukul 11.00.', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PENDING_REVIEW', orderStatus: 'WAITING_PAYMENT',
        createdAt: new Date(now.getTime() - 1000 * 60 * 22).toISOString(), deliveryAt: deliveryAt(1, 10), isOpener: true, isDemo: true,
        items: [{ menuId: 'menu-004', batchId: 'batch-004', name: 'Paket Ayam Kremes', qty: 10, unit: 'porsi', price: 24000, subtotal: 240000 }],
        subtotal: 240000, deliveryFee: 0, total: 240000, proofName: 'bukti-ahmad.jpg', proofKey: '', proofMime: 'image/jpeg', proofUploadedAt: new Date(now.getTime() - 1000 * 60 * 18).toISOString(), reportedSenderName: 'Ahmad Fauzi', reportedAmount: 240000, reportedPaidAt: new Date(now.getTime() - 1000 * 60 * 18).toISOString(), reviewReason: '', refundStatus: 'NONE'
      },
      {
        id: 'order-005', code: 'DR-DEMO-0005', customerName: 'Maria Lestari', phone: '0819-5555-6677',
        fulfillment: 'LALAMOVE', address: 'Daan Mogot, Jakarta Barat', note: '', paymentMethod: 'QRIS_STATIC', paymentStatus: 'EXPIRED', orderStatus: 'CANCELLED',
        createdAt: new Date(now.getTime() - 1000 * 60 * 480).toISOString(), deliveryAt: deliveryAt(1, 10), isOpener: true, isDemo: true,
        items: [{ menuId: 'menu-014', batchId: 'batch-014', name: 'Kue Bugis Ketan Hitam', qty: 20, unit: 'buah', price: 4000, subtotal: 80000 }],
        subtotal: 80000, deliveryFee: 15000, total: 95000, proofName: '', proofKey: '', proofMime: '', proofUploadedAt: null, reportedSenderName: '', reportedAmount: null, reportedPaidAt: null, reviewReason: '', refundStatus: 'NONE'
      }
    ];

    const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
    const dateCode = `${String(jakartaNow.getUTCFullYear()).slice(-2)}${String(jakartaNow.getUTCMonth() + 1).padStart(2, '0')}${String(jakartaNow.getUTCDate()).padStart(2, '0')}`;

    orders.forEach((order, index) => {
      order.code = `DR-${dateCode}-${String(index + 1).padStart(4, '0')}`;
      order.trackingToken = `demo-${dateCode}-${String(index + 1).padStart(4, '0')}`;

      const timeoutMinutes = 60;
      order.paymentDeadline = order.paymentStatus === 'PAID'
        ? null
        : new Date(new Date(order.createdAt).getTime() + timeoutMinutes * 60 * 1000).toISOString();
      order.expiredAt = order.paymentStatus === 'EXPIRED' ? new Date(new Date(order.createdAt).getTime() + timeoutMinutes * 60 * 1000).toISOString() : null;
    });

    const testimonials = [
      { id: 'testimonial-001', name: 'Testimoni WhatsApp', menuName: '', image: 'assets/images/testimoni.webp', caption: '', active: true, sortOrder: 1, isDemo: true },
      { id: 'testimonial-002', name: 'Testimoni WhatsApp', menuName: '', image: 'assets/images/testimoni1.webp', caption: '', active: true, sortOrder: 2, isDemo: true },
      { id: 'testimonial-003', name: 'Testimoni WhatsApp', menuName: '', image: 'assets/images/testimoni2.webp', caption: '', active: true, sortOrder: 3, isDemo: true }
    ];

    const notifications = [
      { id: 'notification-001', type: 'PAYMENT_REVIEW', title: 'Pembayaran perlu diverifikasi', message: 'DR-DEMO-0004 mengunggah bukti pembayaran untuk Paket Ayam Kremes.', orderId: 'order-004', read: false, createdAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(), channel: 'WEBSITE' },
      { id: 'notification-002', type: 'EXPIRING_SOON', title: 'Pesanan segera kedaluwarsa', message: 'DR-DEMO-0003 tersisa sekitar 5 menit sebelum dibatalkan otomatis.', orderId: 'order-003', read: false, createdAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), channel: 'WEBSITE' },
      { id: 'notification-003', type: 'MANUAL_WHATSAPP', title: 'Pesan pelanggan siap', message: 'Pemilik dapat membuka WhatsApp untuk menindaklanjuti pesanan.', orderId: 'order-004', read: true, createdAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(), channel: 'MANUAL_WHATSAPP' }
    ];

    const seed = {
      version: '4.0.0',
      generatedAt: now.toISOString(),
      settings: {
        businessName: 'Dapur Rini',
        tagline: 'Masakan rumahan, dibuat setelah dipesan',
        location: 'Tegal Alur, Jakarta Barat',
        pickupAddress: 'Tegal Alur, Jakarta Barat (alamat lengkap ditampilkan setelah pesanan dikonfirmasi)',
        phone: '0812-3456-7890',
        whatsappNumber: '6281234567890',
        whatsappGreeting: 'Halo Dapur Rini, saya ingin bertanya tentang menu dan pesanan.',
        themeDefault: 'light',
        paymentTimeoutMinutes: 60,
        expiryWarningMinutes: 15,
        autoCancelUnverified: true,
        notificationSound: true,
        instagram: '@dapurrini.id',
        email: 'halo@dapurrini.test',
        operationHours: '07.00–19.00 WIB',
        defaultCutoff: '18.00 WIB',
        bankAccount: 'BCA 1234567890 a.n. Rini Rahmawati',
        qrisImage: '',
        cashPickupEnabled: true,
        operationMode: 'DEMO',
        demoMode: true,
        adminUsername: 'admin',
        sessionTimeoutMinutes: 30
      },
      menus,
      batches,
      orders,
      testimonials,
      notifications,
      activityLogs: [
        { id: 'log-001', action: 'RESET_DEMO', detail: 'Data uji coba v4.0 dibuat ulang dari waktu server.', at: now.toISOString() }
      ]
    };

    seed.notifications.forEach((notification) => {
      const linked = seed.orders.find((order) => order.id === notification.orderId);
      if (linked) notification.message = notification.message.replace(/DR-DEMO-\d{4}/g, linked.code);
    });
    seed.stateRevision = 1;
    seed.nextOrderSequence = seed.orders.length + 1;
    return seed;
  }

  window.DAPUR_RINI_CREATE_SEED = createSeed;
  window.DAPUR_RINI_SEED = createSeed(new Date());
})();
