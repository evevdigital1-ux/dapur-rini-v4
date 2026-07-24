# Roadmap Produksi Dapur Rini, Revisi

## 1. Keputusan Utama

Dapur Rini dapat masuk ke transaksi produksi tanpa payment gateway.

Model pembayaran utama:

1. Transfer bank manual.
2. QRIS statis, jika pemilik sudah memilikinya.
3. Tunai saat pickup, sebagai pilihan terbatas.

Sistem tidak menghubungkan aplikasi langsung ke bank. Pemilik memeriksa dana melalui aplikasi bank atau aplikasi QRIS yang sudah biasa digunakan.

Rencana harus menjaga dua hal sekaligus:

- antarmuka sangat sederhana untuk pemilik;
- aturan transaksi tetap kuat di backend.

## 2. Hasil Review Rencana Sebelumnya

Rencana sebelumnya terlalu kompleks untuk kebutuhan awal produksi.

Fitur yang dihapus dari ruang lingkup awal:

- impor mutasi CSV;
- rekonsiliasi otomatis;
- payment gateway;
- QRIS dinamis;
- integrasi bank;
- persetujuan dua admin;
- multi-admin pada peluncuran awal;
- dashboard keuangan kompleks;
- queue dan worker terpisah;
- laporan akuntansi lengkap;
- integrasi WhatsApp API;
- integrasi kurir otomatis.

Fitur tersebut dapat dipertimbangkan setelah volume transaksi dan kebutuhan operasional terbukti.

## 3. Prinsip Produk Produksi

### 3.1 Pemilik tidak melihat istilah teknis

Pemilik tidak perlu melihat istilah seperti settlement, webhook, reconciliation, idempotency, object storage, atau database transaction.

Antarmuka menggunakan istilah berikut:

- Perlu dicek
- Pembayaran diterima
- Belum masuk
- Minta bukti baru
- Pesanan kedaluwarsa
- Perlu dikembalikan
- Dana sudah dikembalikan

### 3.2 Satu layar, satu keputusan

Setiap kartu pembayaran menampilkan:

- nomor pesanan;
- nama pelanggan;
- jumlah yang harus dibayar;
- metode pembayaran;
- waktu pelanggan mengaku membayar;
- batas pembayaran;
- foto bukti pembayaran.

Tindakan utama:

- Pembayaran diterima
- Belum masuk
- Minta bukti baru

Tindakan lain ditempatkan dalam menu Masalah Pembayaran.

### 3.3 Sistem menangani kerumitan di belakang layar

Backend tetap menangani:

- nomor pesanan unik;
- kapasitas produksi;
- penahanan kuota;
- kedaluwarsa pesanan;
- konsistensi status;
- penyimpanan bukti secara privat;
- pencatatan tindakan admin;
- backup otomatis.

## 4. Alur Pembayaran Produksi

### 4.1 Alur pelanggan

1. Pelanggan memilih menu dan jumlah.
2. Sistem memeriksa kuota.
3. Pelanggan mengisi nama, nomor WhatsApp, dan metode penerimaan.
4. Sistem membuat pesanan dan menahan kuota.
5. Sistem menampilkan rekening atau QRIS statis.
6. Pelanggan membayar.
7. Pelanggan mengunggah bukti pembayaran.
8. Status berubah menjadi Sedang diperiksa.
9. Pemilik memeriksa dana.
10. Pelanggan melihat hasil pemeriksaan pada halaman pelacakan.

### 4.2 Alur pemilik

1. Pemilik membuka menu Pembayaran.
2. Sistem langsung membuka daftar Perlu dicek.
3. Pemilik membuka aplikasi bank atau QRIS.
4. Pemilik mencocokkan nama, nominal, dan waktu.
5. Pemilik menekan satu keputusan.
6. Sistem memperbarui pesanan, kuota, dan rekap produksi.

### 4.3 Pembayaran yang belum terlihat

Tombol Belum masuk tidak langsung membatalkan pesanan.

Sistem:

- mempertahankan status pemeriksaan;
- mencatat waktu pengecekan;
- menampilkan kembali pesanan pada bagian Cek lagi;
- menyediakan tombol Hubungi pelanggan melalui tautan WhatsApp biasa.

### 4.4 Nominal tidak sesuai

Pemilik memilih salah satu alasan:

- pembayaran kurang;
- pembayaran lebih;
- nama pengirim tidak cocok;
- bukti tidak jelas;
- transaksi tidak ditemukan.

Sistem membuat pesan WhatsApp siap kirim. Pemilik tetap menekan tombol kirim secara manual.

### 4.5 Pembayaran terlambat

Pembayaran setelah batas waktu tidak otomatis mengaktifkan pesanan.

Pemilik memilih:

- Terima pesanan, jika kuota masih tersedia.
- Kembalikan dana, jika pesanan tidak dapat dipenuhi.

### 4.6 Pengembalian dana

Sistem tidak mengirim dana otomatis.

Pemilik hanya mencatat:

- jumlah yang harus dikembalikan;
- alasan;
- tanggal pengembalian;
- catatan atau bukti pengembalian.

Status sederhana:

- Perlu dikembalikan
- Dana sudah dikembalikan

## 5. Status yang Ditampilkan

### 5.1 Status pelanggan

- Menunggu pembayaran
- Sedang diperiksa
- Pembayaran diterima
- Perlu perbaikan
- Pesanan kedaluwarsa
- Pesanan dibatalkan
- Sedang disiapkan
- Siap diambil atau dikirim
- Selesai

### 5.2 Status internal backend

Backend boleh memiliki status yang lebih terperinci. Status tersebut tidak perlu ditampilkan kepada pemilik. Pemisahan ini menjaga logika sistem tanpa membebani pengguna.

## 6. Arsitektur Produksi yang Disederhanakan

Komponen awal:

1. Frontend pelanggan dan admin yang sudah ada.
2. Satu layanan backend Node.js.
3. Satu database PostgreSQL terkelola.
4. Penyimpanan file privat untuk bukti pembayaran.
5. Satu tugas terjadwal untuk memproses pesanan kedaluwarsa.
6. Backup otomatis.
7. Monitoring dasar untuk server dan error.

Komponen yang belum diperlukan:

- Redis;
- message queue;
- microservices;
- data warehouse;
- payment gateway;
- integrasi bank;
- aplikasi admin terpisah;
- sistem akuntansi internal.

## 7. Sprint 4, Fondasi Produksi

### Tujuan

Mengganti penyimpanan lokal dengan fondasi yang aman untuk transaksi nyata tanpa mengubah alur utama pengguna.

### Ruang lingkup

- migrasi data transaksi ke PostgreSQL;
- transaksi database untuk checkout dan kuota;
- nomor pesanan unik;
- penahanan kuota dan kedaluwarsa otomatis;
- penyimpanan bukti pembayaran secara privat;
- akun admin produksi;
- verifikasi tambahan hanya saat login dari perangkat baru;
- perangkat utama dapat dipercaya selama periode terbatas;
- HTTPS;
- konfigurasi rahasia di environment server;
- backup otomatis;
- pemulihan backup;
- log tindakan admin;
- staging terpisah dari production.

### Tidak termasuk

- payment gateway;
- impor CSV;
- multi-admin;
- aplikasi autentikator yang rumit bagi pemilik;
- integrasi WhatsApp API;
- integrasi kurir.

### Kriteria selesai

- dua checkout bersamaan tidak dapat melewati kapasitas;
- restart server tidak menghilangkan pesanan;
- bukti pembayaran tidak dapat dibuka tanpa login admin;
- backup dapat dipulihkan;
- seluruh fitur v2.0 tetap bekerja pada staging.

## 8. Sprint 5, Pembayaran Manual yang Sederhana

### Tujuan

Membuat pemilik dapat memeriksa pembayaran tanpa spreadsheet dan tanpa proses teknis.

### Ruang lingkup

- halaman Pembayaran dengan tab Perlu dicek, Cek lagi, dan Selesai;
- kartu pembayaran yang ringkas;
- tombol Pembayaran diterima;
- tombol Belum masuk;
- tombol Minta bukti baru;
- pilihan alasan pembayaran bermasalah;
- unggah ulang bukti oleh pelanggan;
- penanganan pembayaran terlambat;
- pencatatan refund manual;
- tombol Hubungi pelanggan melalui WhatsApp;
- ringkasan harian yang dapat dilihat dan dicetak;
- audit log otomatis di belakang layar.

### Ringkasan harian

Pemilik cukup melihat:

- pesanan dibayar;
- pembayaran perlu dicek;
- pesanan bermasalah;
- jumlah porsi produksi;
- total penjualan yang sudah dikonfirmasi.

Tidak ada CSV. Tidak ada istilah rekonsiliasi.

### Kriteria selesai

- pemilik dapat memproses pembayaran dari HP;
- satu pembayaran dapat diputuskan maksimal dalam tiga langkah;
- perubahan status langsung masuk rekap produksi;
- tindakan salah meminta konfirmasi;
- pelanggan menerima status yang mudah dipahami;
- pembayaran yang sama tidak dapat dikonfirmasi dua kali.

## 9. Sprint 6, Peluncuran Terkendali

### Tujuan

Menguji sistem dengan transaksi nyata dalam skala kecil sebelum dibuka penuh.

### Ruang lingkup

- data menu, rekening, harga, kuota, dan jadwal asli;
- domain resmi;
- kebijakan privasi dan ketentuan transaksi;
- panduan satu halaman untuk pemilik;
- uji penggunaan langsung bersama pemilik;
- uji pada HP pemilik;
- uji checkout bersamaan;
- uji pesanan kedaluwarsa;
- uji pembayaran terlambat;
- uji pembatalan dan pengembalian dana;
- uji backup dan pemulihan;
- monitoring error;
- peluncuran bertahap.

### Tahap peluncuran

#### Tahap A

- satu menu;
- satu tanggal produksi;
- pelanggan terbatas;
- pemilik didampingi saat operasional.

#### Tahap B

- beberapa menu;
- jumlah pesanan dinaikkan secara bertahap;
- evaluasi masalah setiap hari.

#### Tahap C

- operasional normal;
- pengembangan fitur baru hanya berdasarkan masalah nyata.

### Kriteria go-live

- tidak terjadi overselling;
- tidak ada pesanan hilang;
- pemilik dapat memeriksa pembayaran tanpa bantuan teknis;
- rekap produksi sesuai dengan pesanan dibayar;
- backup berhasil dipulihkan;
- bukti pembayaran tetap privat;
- prosedur pembayaran terlambat dan refund sudah dipahami;
- seluruh masalah kritis dari pilot sudah ditutup.

## 10. Dashboard Pemilik yang Direkomendasikan

Navigasi bawah cukup terdiri dari lima menu:

1. Hari ini
2. Pembayaran
3. Produksi
4. Pesanan
5. Pengaturan

### Hari ini

Menampilkan:

- pembayaran yang perlu dicek;
- PO yang segera ditutup;
- jumlah produksi besok;
- pesanan yang perlu ditindaklanjuti.

### Pembayaran

Menampilkan satu antrean keputusan sederhana.

### Produksi

Menampilkan jumlah produk yang harus dibuat per tanggal.

### Pesanan

Menampilkan pencarian berdasarkan nama, nomor WhatsApp, atau nomor pesanan.

### Pengaturan

Menampilkan rekening, QRIS statis, durasi pembayaran, jam operasional, dan logout.

Pengaturan teknis server tidak ditampilkan di dashboard.

## 11. SOP Pemilik

Pemilik hanya perlu memahami enam tindakan operasional:

1. Membuka atau menutup PO.
2. Memeriksa pembayaran.
3. Menghubungi pelanggan.
4. Melihat jumlah produksi.
5. Menandai pesanan siap.
6. Menandai pesanan selesai.

SOP dibuat dalam satu lembar dengan gambar layar dan langkah bernomor.

## 12. Fitur Setelah Operasional Stabil

Fitur berikut hanya dikerjakan jika kebutuhan nyata muncul:

- akun admin tambahan;
- kode login tambahan;
- notifikasi WhatsApp otomatis;
- penghitungan ongkir;
- integrasi kurir;
- laporan penjualan bulanan;
- ekspor data;
- integrasi akuntansi;
- QRIS dinamis;
- payment gateway.

## 13. Keputusan Akhir

Urutan yang benar adalah:

1. kuatkan fondasi data;
2. sederhanakan pembayaran manual;
3. uji bersama pemilik;
4. jalankan pilot kecil;
5. tambah fitur hanya berdasarkan hambatan operasional.

Target produk bukan membuat sistem paling lengkap. Target produk adalah membuat pemilik dapat menerima pesanan, memeriksa pembayaran, dan menyiapkan produksi dengan aman dari satu HP.
