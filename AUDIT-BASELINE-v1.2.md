# Audit dan Review Proyek Dapur Rini MVP Demo v1.2

Tanggal audit: 24 Juli 2026  
Objek audit: `Dapur-Rini-MVP-Demo-v1.2.zip`  
Ruang lingkup: struktur proyek, kualitas kode, aturan bisnis, keamanan, privasi, aksesibilitas, responsivitas, dokumentasi, dan kesesuaian PRD.

## 1. Kesimpulan Eksekutif

**Status untuk demonstrasi klien: CONDITIONAL GO.** Proyek dapat digunakan untuk demonstrasi terarah setelah empat cacat prioritas tinggi diperbaiki dan skenario demo di-reset tepat sebelum presentasi.

**Status untuk pilot operasional atau produksi: NO-GO.** Seluruh transaksi, autentikasi, penyimpanan, validasi, pembatalan, dan penguncian kuota masih berjalan di browser. Arsitektur ini tidak dapat menjamin integritas transaksi, kerahasiaan data, atau kontrol akses.

Kekuatan utama proyek terletak pada desain mobile-first, dokumentasi yang transparan, aturan minimum PO yang cukup jelas, tampilan admin yang lengkap, serta penggunaan escaping pada mayoritas data dinamis. Pengujian menunjukkan alur pembuka PO, verifikasi pembayaran, kedaluwarsa, pengembalian kuota, pencarian, filter admin, dan tampilan 360 sampai 430 piksel berjalan baik.

Risiko utama berada pada konsistensi state lintas tab, reset data berbasis timestamp lama, konflik perubahan status batch, validasi yang hanya mengandalkan UI, dan beberapa ketidaksesuaian dengan PRD.

## 2. Metode Audit

Audit dilakukan melalui:

1. inventarisasi 26 entri ZIP dan pemeriksaan keamanan path ekstraksi;
2. pemeriksaan sintaks `data.js`, `store.js`, dan `app.js` menggunakan `node --check`;
3. review manual terhadap 5.191 baris dokumentasi, HTML, CSS, dan JavaScript;
4. pengujian Chromium pada viewport 360, 390, 430, dan 1.280 piksel;
5. pengujian alur pelanggan dan login admin;
6. pengujian aturan bisnis dengan clock dan storage terkontrol;
7. pemeriksaan referensi aset, ukuran gambar, dan launcher server lokal;
8. perbandingan terhadap kebutuhan fungsional, nonfungsional, dan keamanan dalam PRD.

## 3. Hasil Pengujian Utama

### Berhasil

- Semua file JavaScript lolos pemeriksaan sintaks.
- Seluruh 20 menu tampil.
- Tidak ditemukan overflow dokumen pada viewport utama. Beberapa bagian memang dirancang sebagai rail horizontal.
- Login admin menerima akun demo dan menolak password salah.
- Seluruh halaman admin dapat dirender pada mobile dan desktop.
- Pesanan di bawah minimum pembuka ditolak.
- Checkout pembuka mengubah batch menjadi `OPENER_PENDING_PAYMENT` dan menahan kuota.
- Verifikasi pembuka mengubah batch menjadi `OPEN` dan memindahkan kuota tertahan menjadi terjual.
- Pesanan kedaluwarsa mengembalikan kuota dan batch pembuka menjadi `WAITING_OPENER`.
- Pesanan yang melebihi kuota ditolak.
- Checkout ditolak apabila batch sudah melewati waktu tutup.
- Semua referensi gambar lokal ditemukan.

### Gagal atau bermasalah

- Reset setelah halaman terbuka dua jam memulihkan pesanan contoh dengan timestamp lama. Pesanan contoh langsung berubah menjadi `EXPIRED`.
- Dua checkout dari snapshot state yang sama menghasilkan nomor pesanan yang sama, `DR-DEMO-0006`.
- Batch yang ditutup admin dapat kembali menjadi `WAITING_OPENER` saat pesanan pembuka kedaluwarsa.
- Batch yang ditutup admin dapat kembali menjadi `OPEN` saat pesanan pembuka diverifikasi.
- Kapasitas batch dapat diubah menjadi lebih kecil daripada kuota tertahan melalui edit menu.
- Session admin tetap berlaku setelah clock dimajukan satu tahun.
- Store menerima nama pelanggan dan nomor telepon kosong apabila fungsi dipanggil tanpa form UI.
- Store menerima pengaturan negatif dan nomor WhatsApp tidak valid.
- Generator waktu menghasilkan jadwal berbeda apabila perangkat tidak menggunakan zona waktu Asia/Jakarta.

## 4. Temuan Prioritas

### P0-01. State lintas tab menggunakan pola last-write-wins

**Bukti:** `assets/store.js:32-61`, `assets/store.js:270-305`.

Setiap operasi membaca seluruh JSON dari `localStorage`, memodifikasi salinan, lalu menulis seluruh state kembali. Tidak ada lock, compare-and-swap, version check, atau retry. Dua tab dapat membaca state yang sama dan menghasilkan nomor pesanan sama. Penulisan terakhir juga dapat menghapus pesanan dari tab lain atau menyebabkan reservasi kuota tidak konsisten.

**Dampak:** nomor pesanan ganda, lost update, overselling, dan data admin tidak dapat dipercaya.

**Rekomendasi:** pindahkan pembuatan pesanan dan reservasi kuota ke backend transaksional. Untuk Google Apps Script, gunakan `LockService`, sequence atomik, dan validasi ulang di dalam lock. Untuk demo lokal, tambahkan `stateRevision`, deteksi konflik, dan retry, tetapi jangan menganggap solusi tersebut cukup untuk produksi.

### P0-02. Reset demo menggunakan timestamp lama

**Bukti:** `assets/data.js:5-12`, `assets/data.js:162-168`, `assets/store.js:50-54`.

Seed dibuat satu kali ketika script dimuat. Fungsi reset hanya melakukan deep clone terhadap seed tersebut. Setelah halaman lama terbuka, reset memulihkan deadline dan jadwal yang sudah kedaluwarsa.

**Dampak:** skenario demonstrasi tidak konsisten. Pesanan contoh dapat langsung batal setelah reset.

**Rekomendasi:** ubah seed menjadi factory, misalnya `createSeed(now)`, dan panggil factory setiap reset. Semua waktu relatif harus dihitung ulang.

### P0-03. Penutupan admin dapat dibatalkan oleh verifikasi atau kedaluwarsa pembuka

**Bukti:** `assets/store.js:97-105`, `assets/store.js:345-348`, `assets/store.js:422-432`.

`releaseOrderReservation()` selalu mengubah batch pembuka menjadi `WAITING_OPENER`. `verifyOrder()` selalu mengubahnya menjadi `OPEN`. Kedua fungsi tidak memeriksa apakah admin telah menutup batch. `closeAllOpenBatches()` juga melewatkan `OPENER_PENDING_PAYMENT`.

**Dampak:** batch yang sengaja ditutup dapat terbuka kembali tanpa persetujuan admin.

**Rekomendasi:** terapkan state machine eksplisit. Simpan alasan penutupan, misalnya `closedByAdmin`, dan larang transisi otomatis yang bertentangan. Tentukan kebijakan untuk order pembuka yang masih pending ketika admin menutup PO.

### P0-04. Edit menu dapat membuat kapasitas lebih kecil daripada kuota tertahan

**Bukti:** `assets/store.js:435-445`, `assets/app.js:1025-1032`.

Kapasitas batch diperbarui apabila `soldQty === 0`, tetapi fungsi tidak memperhitungkan `heldQty`. Pada seed, batch Ayam Kremes mempunyai `heldQty = 10`. Admin dapat mengubah kapasitas menjadi 5 melalui form menu.

**Dampak:** `soldQty + heldQty` dapat melebihi kapasitas. Rekap dan status batch menjadi tidak valid.

**Rekomendasi:** tetapkan minimum kapasitas sebesar `soldQty + heldQty`. Lakukan validasi di store dan backend, bukan hanya melalui atribut HTML.

### P1-05. Nomor pesanan tidak memenuhi format dan jaminan unik PRD

**Bukti:** PRD `FR-011`, `assets/store.js:270-271`.

PRD menetapkan format `DR-YYMMDD-XXXX`. Implementasi menggunakan `DR-DEMO-XXXX` dan sequence berdasarkan `orders.length + 1`.

**Dampak:** konflik nomor pada transaksi paralel dan ketidaksesuaian kontrak produk.

**Rekomendasi:** gunakan sequence atomik per tanggal atau identifier unik yang dipetakan ke kode tampilan.

### P1-06. Validasi domain hanya bergantung pada form UI

**Bukti:** `assets/store.js:237-296`, `assets/store.js:413-419`, `assets/store.js:493-501`.

Store tidak memvalidasi nama, telepon, fulfillment, metode pembayaran, alamat, batas waktu, nilai numerik, atau whitelist status secara lengkap. Form HTML memberi batas dasar, tetapi fungsi global tetap menerima payload invalid.

**Dampak:** data korup melalui console, script lain, state hasil migrasi, atau backend yang tidak ketat.

**Rekomendasi:** buat schema validator dan validasi ulang setiap command pada lapisan domain serta backend.

### P1-07. Autentikasi bertentangan dengan bagian keamanan PRD

**Bukti:** `assets/data.js:204-205`, `assets/store.js:549-562`, PRD bagian 23.1.

Password tersimpan sebagai teks biasa. Session hanya berupa flag di `sessionStorage`. Timestamp login disimpan tetapi tidak pernah diperiksa. Tidak ada rate limit atau pemeriksaan otorisasi pada fungsi store.

**Dampak:** siapa pun yang dapat membuka DevTools dapat menjadi admin. Session tidak pernah kedaluwarsa selama tab bertahan.

**Rekomendasi:** untuk produksi, gunakan autentikasi backend, password hashing, session expiry, CSRF protection, role check, dan audit login. Untuk demo, dokumentasi harus menandai bagian keamanan PRD sebagai waiver eksplisit.

### P1-08. Pelacakan pesanan menggunakan kode yang mudah ditebak

**Bukti:** `assets/app.js:595-620`, `assets/store.js:270-271`.

Form pelacakan bahkan menampilkan rentang kode contoh. Hasil menampilkan nama pelanggan, waktu, total, metode penerimaan, dan rincian produk.

**Dampak:** pada data nyata, pihak lain dapat melakukan enumerasi pesanan dan melihat informasi pribadi.

**Rekomendasi:** gunakan tracking token acak dengan entropi memadai atau verifikasi kombinasi kode pesanan dan nomor telepon. Batasi data yang ditampilkan.

### P1-09. Implementasi zona waktu tidak konsisten dengan WIB

**Bukti:** `assets/data.js:5-12`, `assets/store.js:200-203`, `assets/app.js:26-28`, `assets/app.js:1038-1044`.

Seed dan input `datetime-local` memakai zona waktu perangkat. Tampilan kemudian memformat waktu sebagai Asia/Jakarta. Pengujian menghasilkan jadwal 10.00, 17.00, atau 21.00 WIB untuk input seed yang sama ketika zona waktu perangkat berbeda.

**Dampak:** cutoff dan jadwal kirim bergeser pada perangkat di luar WIB atau perangkat dengan konfigurasi zona waktu salah.

**Rekomendasi:** simpan dan hitung waktu dengan aturan zona `Asia/Jakarta`. Gunakan utilitas tanggal tunggal dan uji DST serta boundary tanggal, walaupun WIB tidak memiliki DST.

### P1-10. Rekap produksi tidak memisahkan tanggal dan bulk status salah untuk pickup

**Bukti:** `assets/app.js:784-807`, `assets/app.js:930`.

Halaman “Produksi besok” menggabungkan semua pesanan dibayar yang belum selesai, tanpa pengelompokan tanggal pengiriman. Tanggal ringkasan diambil dari batch pertama. Tombol “Siap dikirim” mengubah seluruh pesanan, termasuk pickup, menjadi `READY_FOR_DELIVERY`.

**Dampak:** rekap produksi dan status operasional dapat salah ketika sistem memiliki lebih dari satu tanggal atau metode penerimaan.

**Rekomendasi:** kelompokkan produksi berdasarkan `deliveryAt`. Terapkan transisi berbeda untuk `PICKUP` dan `LALAMOVE`.

### P1-11. Beberapa kebutuhan PRD belum tersedia

**Bukti:** `assets/app.js:262-313`, `assets/app.js:749-762`.

- FR-002 meminta filter kategori dan status. Pelanggan hanya memiliki pencarian dan filter kategori.
- FR-017 meminta admin membuat batch. Implementasi hanya menyediakan satu batch otomatis per menu dan edit batch yang sudah ada.
- FR-020 reset tidak selalu mengembalikan kondisi demo yang valid.

**Rekomendasi:** sinkronkan PRD, checklist testing, dan implementasi. Pilih antara menambah fitur atau mengubah requirement secara resmi.

### P2-12. Aksesibilitas modal dan form belum memadai

**Bukti:** `index.html:12-14`, `assets/app.js:120-127`, contoh form `assets/app.js:526-537`.

Mayoritas label tidak mempunyai atribut `for` dan input tidak mempunyai `id` yang terkait. Modal tidak memiliki `aria-labelledby`, fokus awal, focus trap, handler Escape, atau pemulihan fokus. Seluruh `#app` memakai `aria-live="polite"`, sehingga rerender besar berpotensi diumumkan sebagai satu region hidup.

**Rekomendasi:** hubungkan label dan kontrol, buat dialog manager, tambahkan focus trap dan Escape, serta batasi live region pada notifikasi singkat.

### P2-13. Server demo terbuka pada semua interface jaringan

**Bukti:** `start-demo.sh`, `START-DEMO.bat` menjalankan `python -m http.server 8080` tanpa `--bind`. Pengujian menunjukkan listener pada `0.0.0.0`.

**Dampak:** folder proyek dapat diakses perangkat lain pada jaringan lokal selama server aktif.

**Rekomendasi:** jalankan `python -m http.server 8080 --bind 127.0.0.1`. Tambahkan pemeriksaan port dan pesan kegagalan yang jelas.

### P2-14. Risiko quota `localStorage` pada screenshot testimoni

**Bukti:** `assets/app.js:951-970`, `assets/store.js:43-47`.

Setiap file dibatasi 1,5 MB, tetapi encoding base64 menambah ukuran dan beberapa upload dapat melewati quota browser. `save()` tidak menangani `QuotaExceededError`.

**Dampak:** penyimpanan gagal tanpa mekanisme pemulihan yang aman.

**Rekomendasi:** kompres dan resize gambar sebelum simpan, batasi total storage, dan tangani kegagalan secara transaksional.

### P2-15. Pengujian masih manual dan kode terlalu monolitik

**Bukti:** `TESTING.md` hanya berisi checklist. `assets/app.js` memiliki 1.078 baris dan `assets/styles.css` 1.131 baris.

**Dampak:** regresi aturan bisnis sulit dideteksi. Perubahan UI dan state saling terkait erat.

**Rekomendasi:** tambahkan unit test untuk state machine dan invarians kuota, integration test untuk checkout, serta E2E test untuk pelanggan dan admin. Pisahkan domain, repository, view, dialog, notification, dan date utilities.

### P3-16. Hardening frontend masih terbatas

Mayoritas data pengguna telah di-escape dengan fungsi `esc()`, yang merupakan praktik baik. Namun, beberapa fallback enum dan identifier dirender tanpa escaping. Proyek juga belum memiliki Content Security Policy atau strategi header keamanan.

**Rekomendasi:** escape semua output secara konsisten, hilangkan inline `onclick`, dan tambahkan CSP saat proyek masuk ke hosting nyata.

## 5. Review Kualitas Desain dan UX

### Kekuatan

- Mobile-first diterapkan dengan baik.
- Navigasi bawah pelanggan dan admin memudahkan penggunaan satu tangan.
- Status batch selalu memiliki teks, bukan warna saja.
- Pita mode demo sangat jelas.
- Kartu produk menampilkan harga, minimum, kuota, waktu tutup, dan tanggal pengiriman.
- Admin memiliki pencarian dan filter pada area operasional utama.
- Foto menggunakan format WebP dan gambar katalog memakai lazy loading.
- Atribusi foto cukup lengkap dan menyebut perubahan aset.

### Perbaikan UX

- Tambahkan filter status pada katalog pelanggan.
- Kurangi informasi akun admin yang ditampilkan setelah login.
- Tambahkan penjelasan ketika status batch berubah akibat kedaluwarsa.
- Tampilkan tanggal pengiriman pada kelompok produksi, bukan satu tanggal global.
- Sediakan konfirmasi yang lebih eksplisit sebelum bulk status.
- Pastikan bottom navigation tidak menutupi tombol terakhir pada modal atau daftar panjang.

## 6. Kesesuaian PRD

### Terpenuhi dengan baik

FR-001, FR-003, FR-004, FR-006, FR-008, FR-009, FR-012, FR-013, FR-015, FR-016, FR-019, NFR-001, NFR-007, dan NFR-009.

### Terpenuhi sebagian

- FR-002: tidak ada filter status pelanggan.
- FR-005 dan FR-007: benar dalam satu alur, tetapi tidak aman pada transaksi paralel.
- FR-010: validasi ulang ada di store, tetapi belum memiliki backend dan schema ketat.
- FR-014: transisi pembuka bekerja, tetapi dapat mengalahkan penutupan admin.
- FR-017: dapat mengedit batch, belum dapat membuat batch baru untuk menu yang sama.
- FR-018: hanya benar apabila seluruh pesanan berada pada satu tanggal.
- FR-020: reset benar hanya selama seed belum usang.
- NFR-003: visual dan touch target baik, tetapi aksesibilitas semantik modal dan form belum lengkap.
- NFR-005: belum ada idempotency atau perlindungan duplicate order.
- NFR-006: format tampilan WIB, tetapi perhitungan memakai zona perangkat.
- NFR-008: banyak aksi dicatat, tetapi bulk update dan autentikasi belum diaudit memadai.

### Tidak terpenuhi

- FR-011: format berbeda dan uniqueness tidak dijamin.
- Persyaratan keamanan PRD 23.1 sampai 23.4 tidak diterapkan pada arsitektur frontend demo.

## 7. Rencana Perbaikan

### Sprint 1, stabilisasi demo

1. Buat `createSeed(now)` dan perbaiki reset.
2. Terapkan state machine batch dan order.
3. Cegah kapasitas lebih kecil dari `soldQty + heldQty`.
4. Perbaiki close-all untuk batch pembuka pending.
5. Tambahkan unit test untuk empat kasus tersebut.
6. Bind server demo ke `127.0.0.1`.

### Sprint 2, konsistensi requirement

1. Tambahkan filter status pelanggan.
2. Putuskan model multi-batch per menu.
3. Perbaiki format dan generator nomor pesanan.
4. Pisahkan rekap produksi per tanggal.
5. Perbaiki status pickup dan delivery.
6. Terapkan utilitas waktu Asia/Jakarta.

### Sprint 3, fondasi produksi

1. Pindahkan transaksi ke backend.
2. Terapkan database dan lock transaksi.
3. Terapkan autentikasi dan otorisasi server-side.
4. Gunakan upload storage terkontrol untuk bukti bayar dan testimoni.
5. Gunakan token tracking acak.
6. Tambahkan audit log immutable.
7. Tambahkan automated test dan CI.
8. Tambahkan monitoring, backup, dan prosedur recovery.

## 8. Keputusan Akhir

Proyek ini merupakan prototipe frontend yang cukup matang secara visual dan efektif untuk menjelaskan konsep bisnis Dapur Rini. Dokumentasi juga jujur mengenai keterbatasan demo. Namun, beberapa cacat state dapat muncul bahkan selama demonstrasi, khususnya reset lama, perubahan kapasitas pada batch dengan kuota tertahan, dan batch yang terbuka kembali setelah ditutup admin.

**Rekomendasi keputusan:** perbaiki seluruh P0 sebelum presentasi formal. Gunakan proyek ini hanya sebagai demo. Jangan gunakan data pelanggan nyata, pembayaran nyata, atau operasi penjualan nyata sebelum backend, autentikasi, locking, validasi, dan kontrol privasi selesai.
