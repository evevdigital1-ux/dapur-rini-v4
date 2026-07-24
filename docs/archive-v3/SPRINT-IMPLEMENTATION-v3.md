# Laporan Implementasi Sprint 4 sampai Sprint 6

## Ringkasan eksekutif

Dapur Rini v3.0 mengubah MVP lokal menjadi kandidat produksi untuk pilot transaksi terbatas tanpa payment gateway, tanpa integrasi bank, dan tanpa impor mutasi CSV. Antarmuka pemilik dibuat sederhana. Pemilik cukup melihat pembayaran, mencocokkan dana pada aplikasi bank atau QRIS, lalu memilih tindakan yang jelas.

Status teknis saat paket dibuat:

- pemeriksaan sintaks lulus;
- 30 dari 30 pengujian otomatis lulus;
- health endpoint lulus pada mode lokal;
- readiness secara sengaja menolak mode lokal yang belum memakai PostgreSQL dan kontrol produksi;
- source tidak berisi data transaksi hasil pengujian;
- deployment PostgreSQL, HTTPS, backup, dan restore telah disiapkan.

Paket ini belum berarti situs sudah aktif menerima transaksi. Domain, server, kredensial produksi, rekening atau QRIS asli, foto produk, UAT pada HP pemilik, restore drill, dan pilot terbatas tetap harus dilakukan.

## Sprint 4: Fondasi produksi

Selesai:

- driver PostgreSQL yang aktif ketika `DATABASE_URL` tersedia;
- migrasi skema awal;
- transaksi serializable dan row lock untuk seluruh perubahan state;
- retry pada serialization failure dan deadlock;
- penyimpanan file lokal hanya sebagai mode uji coba;
- seed produksi tanpa pesanan atau testimoni contoh;
- storage privat untuk bukti pembayaran;
- validasi signature PNG, JPEG, dan WebP;
- batas ukuran unggahan 1,5 MB;
- nama file acak dan traversal protection;
- session admin persisten;
- cookie HttpOnly, SameSite, dan Secure pada produksi;
- CSRF protection;
- verifikasi PIN untuk perangkat baru;
- rate limit login dan unggah bukti;
- audit log;
- health dan readiness endpoint;
- Docker, PostgreSQL, dan Caddy untuk HTTPS;
- backup dan restore PostgreSQL serta file.

## Sprint 5: Pembayaran manual sederhana

Selesai:

- transfer bank manual;
- QRIS statis;
- tunai saat pickup;
- tunai ditolak untuk pesanan delivery;
- pesanan transfer dan QRIS menahan kuota sampai dibayar atau kedaluwarsa;
- unggah bukti setelah nomor pesanan dibuat;
- bukti pembayaran hanya dapat dibuka oleh admin;
- antrean `Perlu dicek`, `Cek lagi`, `Bermasalah`, dan `Selesai`;
- tindakan `Pembayaran diterima`, `Belum masuk`, dan `Minta bukti baru`;
- alasan masalah pembayaran yang mudah dipahami;
- pembayaran terlambat memerlukan keputusan pemilik;
- refund manual dua langkah;
- kuota langsung dilepas ketika refund diperlukan;
- tombol WhatsApp dengan pesan siap kirim tanpa WhatsApp API;
- nilai tunai baru dihitung diterima setelah pesanan selesai;
- penerimaan harian hanya menghitung pembayaran yang benar-benar berstatus dibayar.

## Sprint 6: Kesiapan pilot

Selesai:

- lima menu utama pemilik: Hari ini, Pembayaran, Produksi, Pesanan, dan Pengaturan;
- ringkasan tindakan hari ini;
- rekap produksi per tanggal;
- pencarian pesanan;
- pengaturan rekening, QRIS, batas pembayaran, dan tunai pickup;
- panduan pemilik satu halaman;
- SOP pembayaran manual;
- daftar UAT pilot;
- draft kebijakan privasi;
- draft syarat transaksi dan pembatalan;
- panduan deployment dan operasi;
- readiness gate yang mencegah mode uji dianggap siap produksi.

## Pengujian otomatis

Cakupan 30 skenario meliputi:

- checkout paralel tanpa lost update;
- nomor pesanan unik;
- privasi state publik;
- login dan cookie HttpOnly;
- CSRF;
- tracking dengan kode dan nomor telepon;
- static file dan traversal protection;
- bukti pembayaran privat;
- reset dinamis dan zona waktu Jakarta;
- penutupan batch;
- invarians kapasitas;
- multi-batch;
- validasi data pelanggan;
- transfer manual dua tahap;
- idempotensi konfirmasi pembayaran;
- cek lagi dan unggah bukti baru;
- tunai pickup;
- pembayaran terlambat;
- refund dan pelepasan kuota;
- backup dan recovery mode lokal;
- frontend tanpa business state di `localStorage`.

## Batasan yang disengaja

- Tidak ada payment gateway.
- Tidak ada integrasi bank.
- Tidak ada impor CSV.
- Tidak ada WhatsApp API.
- Tidak ada integrasi kurir otomatis.
- Tidak ada multi-admin kompleks pada tahap awal.
- PostgreSQL menyimpan satu agregat state bisnis JSONB yang dikunci per transaksi. Desain ini sesuai untuk pilot berkapasitas rendah, tetapi perlu normalisasi tabel jika volume, pelaporan, atau jumlah operator meningkat.

## Verifikasi yang belum dapat dilakukan di lingkungan ini

- container PostgreSQL 18 dan Caddy belum dijalankan secara langsung karena Docker tidak tersedia;
- dependency `pg` belum diunduh karena akses registry npm mengalami timeout;
- runtime target Node.js 24 belum tersedia pada lingkungan uji, sehingga pemeriksaan dijalankan dengan Node.js 22;
- browser end-to-end pada localhost belum dijalankan ulang;
- rekening, QRIS, domain, TLS, backup off-server, dan restore PostgreSQL nyata belum diuji;
- dokumen hukum masih berupa draft dan harus ditinjau sesuai bentuk usaha serta wilayah operasi.

## Keputusan kesiapan

- Source dan automated regression: LULUS.
- Demo lokal: GO.
- Staging PostgreSQL: SIAP DI-DEPLOY DAN DIUJI.
- Pilot transaksi nyata: CONDITIONAL GO setelah seluruh checklist go-live lulus.
- Peluncuran publik penuh: NO-GO sebelum pilot terbatas, UAT pemilik, restore drill, dan penutupan temuan staging selesai.
