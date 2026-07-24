# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# Dapur Rini — Sistem Pre-Order Makanan Rumahan

**Nama dokumen:** PRD RINI  
**Nama proyek:** Dapur Rini  
**Jenis produk:** Website katalog, pre-order, checkout, dan dashboard admin  
**Lokasi usaha dummy:** Tegal Alur, Jakarta Barat  
**Status dokumen:** Draft untuk prototipe dan pengujian kepada klien  
**Versi:** 1.0  
**Tanggal:** 24 Juli 2026  

---

## 1. Ringkasan Eksekutif

Dapur Rini adalah prototipe website penjualan makanan rumahan berbasis **pre-order (PO)**. Website ini dirancang untuk usaha rumahan yang menjual paket makanan, kue, jajanan tradisional, dan snack box dengan sistem produksi berdasarkan pesanan.

Sistem mempunyai aturan khusus. Beberapa menu tidak dapat langsung dibeli satuan ketika sesi PO baru dibuka. Contohnya, Paket Ayam Bakar membutuhkan pesanan pembuka minimal 10 porsi. Selama belum ada pelanggan yang memesan dan membayar minimal 10 porsi, pelanggan lain tidak dapat membeli satu porsi.

Setelah pesanan pembuka memenuhi jumlah minimum dan pembayaran dinyatakan berhasil, status PO berubah menjadi aktif. Pelanggan berikutnya kemudian dapat membeli menu tersebut mulai dari satu porsi, selama batas waktu dan kapasitas produksi masih tersedia.

Website akan mempunyai dua area utama:

1. **Halaman pelanggan**, untuk melihat menu, memahami status PO, memesan, memilih pengiriman, dan memantau status pesanan.
2. **Dashboard admin**, untuk mengelola menu, membuka atau menutup PO, memverifikasi pembayaran, melihat rekap produksi, dan mengatur pengiriman.

Versi pertama proyek ini dibuat sebagai **demo yang dapat diperlihatkan dan diuji kepada klien**. Seluruh produk, transaksi, pelanggan, pembayaran, dan pengiriman menggunakan data dummy. Integrasi payment gateway, WhatsApp API, dan Lalamove API belum diperlukan pada tahap prototipe.

---

## 2. Tujuan Produk

### 2.1 Tujuan utama

Membuat prototipe website mobile-friendly yang memperlihatkan bagaimana usaha makanan rumahan dapat mengelola:

- katalog makanan;
- sistem PO berbasis minimum pemesanan;
- pembukaan pembelian satuan setelah target awal terpenuhi;
- batas waktu pemesanan;
- pembayaran;
- pengiriman keesokan hari;
- pengambilan mandiri;
- serta pengelolaan operasional dari HP.

### 2.2 Tujuan prototipe

Prototipe digunakan untuk:

- memperlihatkan konsep kepada calon klien;
- menguji apakah alur PO mudah dipahami pelanggan;
- menguji apakah dashboard admin cukup sederhana bagi orang awam;
- mendapatkan masukan sebelum integrasi pembayaran dan pengiriman nyata;
- menjadi dasar estimasi biaya dan waktu pengembangan versi produksi.

### 2.3 Indikator keberhasilan prototipe

Prototipe dianggap berhasil apabila penguji dapat:

1. memahami status PO tanpa penjelasan panjang;
2. membedakan menu yang masih menunggu pembuka, aktif, hampir tutup, dan ditutup;
3. menyelesaikan proses pemesanan dari HP;
4. memahami bahwa pengiriman dilakukan keesokan hari;
5. memilih antara Lalamove dummy atau ambil sendiri;
6. menggunakan dashboard admin tanpa membuka Google Sheets;
7. menambah menu dan membuka sesi PO melalui HP;
8. memverifikasi pembayaran dummy dalam beberapa langkah;
9. melihat rekap produksi untuk hari berikutnya.

---

## 3. Permasalahan yang Diselesaikan

Usaha makanan rumahan sering menghadapi beberapa masalah berikut:

- produksi dilakukan berdasarkan pesanan agar tidak banyak sisa;
- beberapa menu hanya layak diproduksi jika jumlah minimum tercapai;
- pelanggan ingin membeli satuan, tetapi produksi belum dapat dimulai jika pesanan terlalu sedikit;
- pemilik usaha mencatat pesanan secara manual melalui WhatsApp;
- perubahan jumlah pesanan sering tidak tercatat dengan rapi;
- pembayaran dan bukti transfer tersebar di chat;
- batas waktu pemesanan tidak konsisten;
- pemilik usaha perlu waktu untuk membeli bahan sebelum produksi;
- rekap jumlah makanan untuk besok dihitung manual;
- alamat pengiriman harus disalin satu per satu;
- pengelolaan sistem melalui laptop tidak praktis.

Dapur Rini menyederhanakan proses tersebut dalam satu alur yang terstruktur.

---

## 4. Prinsip Produk

### 4.1 Mobile-first

Halaman pelanggan dan dashboard admin dirancang lebih dahulu untuk layar HP.

### 4.2 Sederhana bagi orang awam

Pemilik usaha tidak perlu memahami spreadsheet, kode, atau istilah teknis.

### 4.3 Status harus terlihat jelas

Setiap menu selalu menunjukkan:

- apakah PO belum dibuka;
- apakah sedang menunggu pembayaran pembuka;
- apakah pembelian satuan sudah tersedia;
- kapan pemesanan ditutup;
- apakah kuota sudah habis;
- dan kapan pesanan dikirim.

### 4.4 Aturan dijalankan di backend

Validasi jumlah minimum, kapasitas, pembayaran, dan waktu penutupan tidak boleh hanya mengandalkan tampilan.

### 4.5 Prototipe tetap terasa nyata

Walaupun menggunakan data dummy, alur, tampilan status, validasi, dan data operasional harus menyerupai sistem produksi.

### 4.6 Fitur tambahan tidak boleh mengganggu MVP

Integrasi kompleks disimpan untuk fase berikutnya. Fokus versi demo adalah membuktikan bahwa sistem PO dan dashboard mudah dipahami.

---

## 5. Ruang Lingkup Produk

## 5.1 Termasuk dalam MVP demo

### Area pelanggan

- landing page;
- informasi cara kerja PO;
- katalog 20 menu dummy;
- filter kategori;
- pencarian menu;
- detail produk;
- status PO;
- minimum pemesanan pembuka;
- pembelian satuan setelah PO aktif;
- kapasitas maksimal;
- hitung mundur penutupan;
- keranjang;
- checkout;
- data pelanggan;
- pilihan ambil sendiri;
- pilihan pengiriman Lalamove dummy;
- metode pembayaran dummy;
- unggah bukti pembayaran dummy;
- halaman sukses pemesanan;
- pelacakan status pesanan;
- tampilan mobile-friendly.

### Area admin

- login admin dummy;
- ringkasan dashboard;
- kelola menu;
- kelola sesi PO;
- buka dan tutup PO;
- verifikasi pembayaran dummy;
- daftar pesanan;
- detail pesanan;
- rekap produksi;
- daftar pengambilan mandiri;
- daftar pengiriman;
- pengaturan usaha;
- mode demo;
- reset data dummy.

## 5.2 Tidak termasuk dalam MVP demo

- payment gateway nyata;
- verifikasi mutasi bank otomatis;
- QRIS dinamis;
- WhatsApp Business API;
- Lalamove API;
- ongkir real-time;
- pelacakan pengemudi real-time;
- notifikasi push;
- sistem pelanggan dengan password;
- loyalty point;
- kupon kompleks;
- multi-cabang;
- invoice pajak;
- akuntansi;
- stok bahan baku otomatis;
- integrasi marketplace;
- aplikasi Android atau iOS native.

Fitur tersebut dapat ditambahkan setelah prototipe disetujui.

---

## 6. Identitas Usaha Dummy

| Elemen | Data dummy |
|---|---|
| Nama usaha | Dapur Rini |
| Tagline | Masakan rumahan, dibuat setelah dipesan |
| Lokasi | Tegal Alur, Jakarta Barat |
| Nomor WhatsApp | 0812-3456-7890 |
| Instagram | @dapurrini.id |
| Jam operasional | 07.00–19.00 WIB |
| Batas PO default | 18.00 WIB |
| Waktu pengiriman default | Hari berikutnya, 10.00–14.00 WIB |
| Pengambilan mandiri | Tegal Alur, Jakarta Barat |
| Metode pengiriman | Ambil sendiri atau Lalamove dummy |
| Rekening dummy | BCA 1234567890 a.n. Rini Rahmawati |
| QRIS dummy | Gambar QRIS simulasi |
| Email | halo@dapurrini.test |

Seluruh informasi di atas harus diberi penanda internal bahwa datanya hanya untuk demonstrasi.

---

## 7. Pengguna Sistem

## 7.1 Pelanggan baru

Karakteristik:

- membuka website dari HP;
- belum memahami mekanisme minimum pembuka PO;
- ingin melihat harga dan jadwal pengiriman dengan cepat;
- tidak ingin membuat akun;
- terbiasa menggunakan WhatsApp dan transfer bank.

Kebutuhan:

- penjelasan singkat;
- status menu yang mudah dipahami;
- checkout singkat;
- informasi pembayaran yang jelas;
- kepastian tanggal penerimaan.

## 7.2 Pelanggan lama

Karakteristik:

- sudah pernah memesan;
- ingin proses cepat;
- biasanya memesan menu yang sama;
- ingin mengetahui PO mana yang sudah aktif.

Kebutuhan:

- katalog yang mudah difilter;
- status pesanan;
- pemesanan ulang;
- data alamat yang dapat diisi kembali pada fase lanjutan.

## 7.3 Admin utama

Karakteristik:

- pemilik usaha;
- menggunakan HP;
- tidak terbiasa dengan dashboard rumit;
- bertanggung jawab atas menu, pembayaran, produksi, dan pengiriman.

Kebutuhan:

- tombol besar;
- istilah sederhana;
- ringkasan pekerjaan hari ini;
- tindakan cepat;
- tidak perlu membuka spreadsheet.

## 7.4 Admin operasional

Karakteristik:

- membantu memeriksa pesanan atau pengiriman;
- hanya membutuhkan akses tertentu.

Kebutuhan masa depan:

- pembagian peran;
- akses terbatas;
- catatan aktivitas.

Pada MVP demo, cukup tersedia satu akun admin.

---

## 8. Konsep Utama: Batch PO

Setiap produk dapat mempunyai satu atau lebih sesi pemesanan yang disebut **batch PO**.

Contoh:

- Produk: Paket Ayam Bakar Komplet
- Batch: Pengiriman 25 Juli 2026
- Dibuka: 24 Juli 2026 pukul 07.00
- Ditutup: 24 Juli 2026 pukul 18.00
- Minimum pembuka: 10 porsi
- Minimum setelah aktif: 1 porsi
- Kapasitas maksimal: 50 porsi

Produk dan batch harus dipisahkan.

Alasannya:

- satu produk dapat dijual berulang kali pada tanggal berbeda;
- harga dapat berubah pada batch berikutnya;
- minimum pembuka dapat berbeda;
- kapasitas dapat berubah;
- riwayat transaksi tidak rusak ketika data produk diperbarui;
- admin dapat menjadwalkan PO beberapa hari ke depan.

---

## 9. Status Batch PO

| Status | Arti | Aturan pembelian |
|---|---|---|
| DRAFT | Batch masih disiapkan admin | Tidak dapat dipesan |
| SCHEDULED | Batch dijadwalkan tetapi belum dibuka | Tidak dapat dipesan |
| WAITING_OPENER | Menunggu pemesan pembuka | Wajib membeli sesuai minimum pembuka |
| OPENER_PENDING_PAYMENT | Pesanan pembuka dibuat tetapi belum dibayar | Pelanggan lain belum dapat membeli |
| OPEN | Pembayaran pembuka berhasil | Dapat membeli mulai minimum reguler |
| CLOSING_SOON | Mendekati batas waktu | Tetap dapat membeli selama kuota ada |
| SOLD_OUT | Kapasitas habis | Tidak dapat membeli |
| CLOSED | Waktu pemesanan berakhir | Tidak dapat membeli |
| CANCELLED | Batch dibatalkan admin | Tidak dapat membeli |
| IN_PRODUCTION | Sedang diproduksi | Tidak dapat membeli |
| READY | Siap diambil atau dikirim | Tidak dapat membeli |
| COMPLETED | Semua pesanan selesai | Arsip |

Pada tampilan pelanggan, istilah teknis di atas diterjemahkan menjadi bahasa sederhana.

Contoh:

- `WAITING_OPENER` → “Butuh pemesan pertama”
- `OPENER_PENDING_PAYMENT` → “Menunggu pembayaran pembuka”
- `OPEN` → “PO aktif”
- `CLOSING_SOON` → “Segera ditutup”
- `SOLD_OUT` → “Kuota habis”

---

## 10. Aturan Bisnis Utama

## 10.1 Aturan pemesan pembuka

1. Ketika status batch adalah `WAITING_OPENER`, jumlah minimal yang dapat dipesan sama dengan minimum pembuka.
2. Contoh minimum pembuka 10 porsi, pelanggan tidak dapat memesan 1–9 porsi.
3. Setelah checkout, status batch berubah menjadi `OPENER_PENDING_PAYMENT`.
4. Pesanan pembuka mempunyai batas pembayaran.
5. Selama pembayaran belum diverifikasi, pelanggan lain belum dapat membeli menu tersebut.
6. Jika pembayaran berhasil, batch berubah menjadi `OPEN`.
7. Jika pembayaran kedaluwarsa, pesanan dibatalkan otomatis dan batch kembali ke `WAITING_OPENER`.
8. Admin dapat membatalkan pesanan pembuka melalui dashboard.
9. Satu batch hanya mempunyai satu pesanan pembuka aktif pada satu waktu.

## 10.2 Aturan pembayaran pembuka

Untuk demo:

- pembayaran menggunakan status simulasi;
- admin dapat menekan tombol “Verifikasi pembayaran”;
- admin juga dapat menekan “Tolak” atau “Tandai kedaluwarsa”;
- setelah verifikasi, jumlah pesanan langsung dihitung sebagai terjual;
- status batch berubah otomatis.

## 10.3 Aturan pembelian reguler

Setelah batch `OPEN`:

- minimum pembelian kembali ke minimum reguler;
- contoh minimum reguler 1 porsi;
- pelanggan dapat membeli selama kuota tersedia;
- jumlah pembelian tidak boleh melebihi sisa kapasitas.

## 10.4 Aturan kapasitas

Setiap batch mempunyai kapasitas maksimum.

Rumus:

```text
Sisa kapasitas = Kapasitas maksimum - Jumlah pesanan dibayar
```

Pesanan yang belum dibayar tidak langsung mengurangi kapasitas permanen, tetapi dapat menahan kuota selama batas pembayaran.

Untuk MVP demo:

```text
Sisa tersedia = Kapasitas maksimum
                 - Pesanan dibayar
                 - Pesanan menunggu pembayaran yang belum kedaluwarsa
```

## 10.5 Aturan waktu tutup

- setiap batch mempunyai waktu tutup;
- setelah waktu tutup, status menjadi `CLOSED`;
- pelanggan tidak dapat checkout;
- keranjang harus diperiksa ulang saat checkout;
- admin dapat menutup lebih awal;
- admin dapat membuka kembali jika masih dalam kondisi yang diperbolehkan.

## 10.6 Aturan pengiriman

- produksi dan pengiriman dilakukan pada hari setelah PO ditutup;
- pelanggan memilih ambil sendiri atau Lalamove dummy;
- jadwal dapat berbeda untuk setiap batch;
- pesanan dalam satu checkout sebaiknya hanya memuat produk dengan tanggal pengiriman yang sama pada MVP.

Pembatasan ini menyederhanakan alur dan menghindari satu transaksi dengan beberapa tanggal pengiriman.

## 10.7 Aturan pembatalan

- pesanan belum dibayar dapat dibatalkan;
- pesanan sudah dibayar hanya dapat dibatalkan admin;
- setelah batch masuk `IN_PRODUCTION`, pembatalan tidak tersedia;
- pembatalan pemesan pembuka harus menampilkan peringatan;
- bila pembatalan pembuka terjadi setelah pelanggan lain masuk, batch tidak otomatis ditutup tanpa keputusan admin.

## 10.8 Aturan perubahan harga

- harga pada pesanan disimpan sebagai snapshot;
- perubahan harga produk tidak mengubah transaksi lama;
- harga dapat diatur per batch.

## 10.9 Aturan data demo

- setiap transaksi dummy diberi label `is_demo = true`;
- dashboard menampilkan pita “Mode Demo”;
- data demo dapat direset;
- tidak ada transaksi nyata;
- tombol integrasi eksternal harus menggunakan simulasi.

---

## 11. Alur Pelanggan

## 11.1 Membuka landing page

Pelanggan melihat:

- logo Dapur Rini;
- pesan utama;
- waktu tutup pesanan hari ini;
- tombol melihat menu;
- penjelasan singkat cara kerja PO;
- daftar menu unggulan.

## 11.2 Melihat katalog

Pelanggan dapat:

- mencari nama produk;
- memfilter kategori;
- memilih hanya menu yang sudah aktif;
- melihat menu yang hampir tutup;
- melihat tanggal pengiriman.

## 11.3 Membuka detail menu

Informasi yang tampil:

- foto;
- nama produk;
- deskripsi;
- isi paket;
- harga;
- satuan;
- minimum pembuka;
- minimum reguler;
- sisa kuota;
- tanggal pengiriman;
- batas waktu;
- status;
- catatan alergi;
- tombol pemesanan.

## 11.4 Memesan sebagai pembuka

Contoh:

```text
Paket Ayam Bakar Komplet
Minimum pembuka: 10 porsi
Harga: Rp25.000 per porsi

Jumlah awal otomatis: 10
Pelanggan dapat menambah jumlah, tetapi tidak dapat mengurangi di bawah 10.
```

Setelah checkout:

- pesanan berstatus menunggu pembayaran;
- batch berstatus menunggu pembayaran pembuka;
- tampil batas waktu pembayaran;
- pelanggan mendapat nomor pesanan.

## 11.5 Memesan setelah PO aktif

Contoh:

```text
PO aktif
Minimum pembelian: 1 porsi
Sisa kuota: 26 porsi
```

Pelanggan dapat menambah satu atau beberapa porsi.

## 11.6 Keranjang

Keranjang menampilkan:

- foto kecil;
- nama produk;
- tanggal pengiriman;
- jumlah;
- harga;
- subtotal;
- catatan;
- tombol hapus;
- total.

Validasi dilakukan ulang ketika membuka checkout.

## 11.7 Checkout

Form checkout:

### Data pelanggan

- nama lengkap;
- nomor WhatsApp;
- email opsional.

### Metode penerimaan

- ambil sendiri;
- Lalamove dummy.

### Ambil sendiri

- pilihan jam pengambilan;
- nama pengambil;
- catatan.

### Lalamove dummy

- nama penerima;
- nomor penerima;
- alamat lengkap;
- kecamatan;
- patokan;
- tautan lokasi opsional;
- catatan kurir.

### Pembayaran dummy

- transfer bank dummy;
- QRIS dummy;
- bayar di tempat tidak tersedia.

### Persetujuan

Pelanggan menyetujui:

- tanggal pengiriman;
- batas pembayaran;
- ketentuan pembatalan;
- data yang dimasukkan benar.

## 11.8 Halaman sukses

Menampilkan:

- nomor pesanan;
- total;
- batas pembayaran;
- rekening atau QRIS dummy;
- tombol unggah bukti;
- tombol cek pesanan;
- tombol chat WhatsApp dummy;
- penjelasan bahwa transaksi merupakan simulasi.

## 11.9 Pelacakan pesanan

Pelanggan memasukkan:

- nomor pesanan;
- empat digit terakhir nomor WhatsApp.

Status:

```text
Pesanan dibuat
→ Menunggu pembayaran
→ Pembayaran diverifikasi
→ Pesanan diterima
→ Sedang disiapkan
→ Siap diambil / Dalam pengiriman
→ Selesai
```

---

## 12. Struktur Landing Page

## 12.1 Header

Isi:

- logo;
- nama Dapur Rini;
- tombol pencarian;
- ikon keranjang.

Header tetap terlihat ketika pengguna menggulir halaman.

## 12.2 Hero section

Contoh isi:

> **Masakan rumahan, dibuat setelah dipesan**  
> Pesan hari ini, kami siapkan dengan bahan segar, lalu dikirim besok.

Tombol:

- Lihat Menu Hari Ini
- Cara Kerja PO

Informasi:

> Pesanan hari ini ditutup pukul 18.00 WIB.

## 12.3 Cara kerja PO

Tiga langkah:

1. Pilih menu.
2. Bayar pesanan.
3. Terima besok.

Tambahkan catatan:

> Beberapa menu membutuhkan pemesan pembuka sebelum dapat dibeli satuan.

## 12.4 Menu unggulan

Menampilkan 4–6 produk.

## 12.5 Semua menu

Dilengkapi:

- pencarian;
- filter kategori;
- filter status;
- urutan berdasarkan waktu tutup.

## 12.6 Keunggulan

Contoh:

- dibuat setelah dipesan;
- bahan disiapkan segar;
- cocok untuk keluarga dan acara;
- tersedia ambil sendiri atau pengiriman.

## 12.7 Testimoni dummy

Gunakan 3–5 testimoni dan beri label dummy pada data internal.

## 12.8 Informasi pengiriman

Menjelaskan:

- area asal pengiriman;
- waktu pengiriman;
- ongkir dihitung terpisah pada demo;
- jadwal ambil sendiri.

## 12.9 FAQ

Pertanyaan minimum:

- Apa itu pemesan pembuka?
- Mengapa saya belum bisa membeli satu porsi?
- Kapan pesanan dikirim?
- Bagaimana menghitung ongkir?
- Apakah pesanan bisa dibatalkan?
- Bagaimana mengecek status pesanan?

## 12.10 Footer

Isi:

- alamat;
- WhatsApp;
- Instagram;
- kebijakan pemesanan;
- kebijakan pembatalan;
- catatan mode demo.

---

## 13. Kartu Produk

Setiap kartu menampilkan:

- foto;
- nama menu;
- kategori;
- harga;
- satuan;
- tanggal pengiriman;
- status PO;
- minimum;
- sisa kapasitas;
- waktu tutup;
- tombol utama.

### Contoh status menunggu pembuka

```text
Paket Ayam Bakar Komplet
Rp25.000 / porsi

Butuh pemesan pertama
Minimal pemesanan pembuka: 10 porsi

Dikirim besok, 10.00–14.00 WIB

[Buka PO — Pesan 10 Porsi]
```

### Contoh status menunggu pembayaran

```text
Paket Ayam Bakar Komplet
Rp25.000 / porsi

Menunggu pembayaran pembuka
Pembelian satuan akan tersedia setelah pembayaran dikonfirmasi.

[Lihat Menu Lain]
```

### Contoh status aktif

```text
Paket Ayam Bakar Komplet
Rp25.000 / porsi

PO aktif
Bisa dipesan mulai 1 porsi
Sisa kuota: 26

Ditutup dalam 02:15:34

[Tambah ke Keranjang]
```

### Contoh status ditutup

```text
Paket Ayam Bakar Komplet

PO hari ini sudah ditutup
Jadwal berikutnya akan segera tersedia.

[Ingatkan Saya — Fitur Masa Depan]
```

Pada MVP, tombol pengingat hanya tampil sebagai elemen demo dan tidak mengirim notifikasi.

---

## 14. Dashboard Admin

## 14.1 Navigasi utama

Navigasi bawah pada HP:

1. Beranda
2. Menu
3. Pesanan
4. Produksi
5. Lainnya

Bagian “Lainnya” memuat:

- pengiriman;
- pengaturan;
- mode demo;
- keluar.

## 14.2 Beranda admin

Kartu ringkasan:

- pesanan hari ini;
- pembayaran perlu diperiksa;
- batch menunggu pembuka;
- batch hampir tutup;
- total pesanan dibayar;
- jumlah porsi untuk produksi besok.

Tindakan cepat:

- tambah menu;
- buat batch PO;
- tutup semua PO hari ini;
- verifikasi pembayaran;
- lihat produksi besok.

## 14.3 Kelola menu

Fitur:

- daftar kartu menu;
- pencarian;
- filter kategori;
- tambah;
- edit;
- nonaktifkan;
- duplikasi;
- pratinjau.

Form menu:

- nama;
- kategori;
- foto;
- deskripsi;
- isi paket;
- harga default;
- satuan;
- minimum pembuka default;
- minimum reguler;
- kapasitas default;
- catatan alergi;
- status tampil;
- unggulan.

## 14.4 Kelola batch PO

Form batch:

- produk;
- harga batch;
- minimum pembuka;
- minimum reguler;
- kapasitas;
- waktu mulai;
- waktu tutup;
- tanggal produksi;
- tanggal pengiriman;
- slot pengambilan;
- status.

Aksi:

- buka;
- tutup;
- batalkan;
- duplikasi jadwal;
- lihat pesanan;
- ubah kapasitas.

## 14.5 Pesanan

Tab:

- Semua
- Baru
- Menunggu Bayar
- Perlu Verifikasi
- Dibayar
- Diproses
- Selesai
- Dibatalkan

Kartu pesanan:

- nomor;
- pelanggan;
- jumlah item;
- total;
- metode penerimaan;
- status pembayaran;
- status pesanan;
- waktu checkout.

Aksi:

- lihat detail;
- verifikasi;
- tolak pembayaran;
- batalkan;
- ubah status;
- cetak ringkasan;
- buka WhatsApp dummy.

## 14.6 Verifikasi pembayaran

Admin melihat:

- nomor pesanan;
- nama pelanggan;
- total;
- metode pembayaran;
- waktu unggah;
- gambar bukti dummy.

Tombol:

- Verifikasi
- Tolak
- Minta Unggah Ulang
- Tandai Kedaluwarsa

Ketika diverifikasi:

- status pembayaran menjadi `PAID`;
- pesanan masuk rekap produksi;
- batch pembuka berubah menjadi `OPEN` jika syarat terpenuhi.

## 14.7 Produksi

Rekap per tanggal:

| Menu | Jumlah dibayar | Cadangan | Total produksi |
|---|---:|---:|---:|
| Paket Ayam Bakar | 37 | 0 | 37 |
| Donat Cokelat | 48 | 0 | 48 |
| Kue Bugis | 60 | 0 | 60 |

Fitur:

- filter tanggal;
- lihat detail pelanggan;
- tandai mulai produksi;
- tandai siap;
- unduh atau cetak ringkasan;
- catatan dapur.

## 14.8 Pengiriman

Tab:

- Ambil sendiri
- Lalamove belum dipesan
- Lalamove sudah dipesan
- Dalam pengiriman
- Selesai

Untuk demo, tombol “Pesan Lalamove” membuka modal simulasi:

- ongkir dummy;
- nama pengemudi dummy;
- nomor kendaraan dummy;
- status dummy.

## 14.9 Pengaturan

Admin dapat mengubah:

- nama usaha;
- logo;
- nomor WhatsApp;
- alamat;
- rekening dummy;
- QRIS dummy;
- jam tutup default;
- durasi pembayaran;
- slot pengiriman;
- teks kebijakan;
- mode demo.

## 14.10 Reset demo

Fitur wajib prototipe:

- reset transaksi;
- reset batch;
- isi ulang data dummy;
- konfirmasi dua langkah;
- data menu dapat dipertahankan.

---

## 15. Daftar 20 Menu Dummy

| No. | Nama menu | Kategori | Harga | Satuan | Minimum pembuka | Kapasitas |
|---:|---|---|---:|---|---:|---:|
| 1 | Paket Ayam Bakar Komplet | Paket Nasi | Rp25.000 | porsi | 10 | 50 |
| 2 | Paket Ayam Goreng Serundeng | Paket Nasi | Rp24.000 | porsi | 10 | 50 |
| 3 | Paket Ayam Geprek Sambal Bawang | Paket Nasi | Rp22.000 | porsi | 10 | 60 |
| 4 | Paket Ayam Kremes | Paket Nasi | Rp24.000 | porsi | 10 | 50 |
| 5 | Paket Nasi Liwet Ayam Suwir | Paket Nasi | Rp27.000 | porsi | 10 | 40 |
| 6 | Paket Nasi Kuning Komplet | Paket Nasi | Rp23.000 | box | 15 | 60 |
| 7 | Paket Nasi Uduk Komplet | Paket Nasi | Rp22.000 | box | 15 | 60 |
| 8 | Paket Ikan Bakar Sambal Kecap | Paket Nasi | Rp28.000 | porsi | 10 | 40 |
| 9 | Paket Lele Goreng Sambal Lalapan | Paket Nasi | Rp20.000 | porsi | 10 | 50 |
| 10 | Paket Telur Balado dan Orek Tempe | Paket Nasi | Rp18.000 | porsi | 10 | 50 |
| 11 | Donat Gula Halus | Donat | Rp30.000 | kotak isi 6 | 2 | 20 |
| 12 | Donat Cokelat Meses | Donat | Rp36.000 | kotak isi 6 | 2 | 20 |
| 13 | Donat Aneka Topping | Donat | Rp42.000 | kotak isi 6 | 2 | 20 |
| 14 | Kue Bugis Ketan Hitam | Jajanan Tradisional | Rp4.000 | buah | 20 | 100 |
| 15 | Nagasari Pisang | Jajanan Tradisional | Rp4.000 | buah | 20 | 100 |
| 16 | Pisang Bolen Cokelat | Kue | Rp40.000 | kotak isi 8 | 2 | 20 |
| 17 | Bolu Pisang Panggang | Kue | Rp45.000 | loyang | 2 | 12 |
| 18 | Risoles Ragout Ayam | Snack | Rp5.000 | buah | 20 | 100 |
| 19 | Lemper Ayam | Jajanan Tradisional | Rp4.500 | buah | 20 | 100 |
| 20 | Snack Box Tiga Macam | Snack Box | Rp15.000 | box | 10 | 80 |

---

## 16. Contoh Data Batch Dummy

| Produk | Status awal | Terjual | Kapasitas | Tutup |
|---|---|---:|---:|---|
| Paket Ayam Bakar Komplet | OPEN | 24 | 50 | 18.00 |
| Paket Ayam Goreng Serundeng | WAITING_OPENER | 0 | 50 | 18.00 |
| Paket Ayam Geprek Sambal Bawang | CLOSING_SOON | 42 | 60 | 16.00 |
| Paket Ayam Kremes | OPENER_PENDING_PAYMENT | 10 tertahan | 50 | 18.00 |
| Paket Nasi Liwet Ayam Suwir | SOLD_OUT | 40 | 40 | 18.00 |
| Paket Nasi Kuning Komplet | OPEN | 32 | 60 | 18.00 |
| Donat Aneka Topping | OPEN | 9 kotak | 20 | 17.00 |
| Kue Bugis Ketan Hitam | WAITING_OPENER | 0 | 100 | 15.00 |
| Bolu Pisang Panggang | CLOSED | 8 | 12 | 12.00 |
| Snack Box Tiga Macam | OPEN | 35 | 80 | 17.00 |

Data ini memastikan seluruh status penting dapat diperlihatkan saat demo.

---

## 17. Contoh Data Pelanggan Dummy

| Nama | WhatsApp | Lokasi | Metode |
|---|---|---|---|
| Siti Rahma | 0812-1111-2233 | Kalideres | Lalamove |
| Budi Santoso | 0813-2222-3344 | Cengkareng | Ambil sendiri |
| Nabila Putri | 0856-3333-4455 | Kembangan | Lalamove |
| Ahmad Fauzi | 0877-4444-5566 | Tegal Alur | Ambil sendiri |
| Maria Lestari | 0819-5555-6677 | Daan Mogot | Lalamove |

---

## 18. Contoh Pesanan Dummy

| Nomor | Pelanggan | Menu | Jumlah | Total | Pembayaran | Pesanan |
|---|---|---|---:|---:|---|---|
| DR-260724-0001 | Siti Rahma | Paket Ayam Bakar | 10 | Rp250.000 | PAID | CONFIRMED |
| DR-260724-0002 | Budi Santoso | Paket Ayam Bakar | 2 | Rp50.000 | PAID | CONFIRMED |
| DR-260724-0003 | Nabila Putri | Donat Aneka Topping | 2 kotak | Rp84.000 | PENDING_REVIEW | WAITING_PAYMENT |
| DR-260724-0004 | Ahmad Fauzi | Snack Box | 10 | Rp150.000 | PAID | IN_PRODUCTION |
| DR-260724-0005 | Maria Lestari | Kue Bugis | 20 | Rp80.000 | EXPIRED | CANCELLED |

---

## 19. Status Pesanan dan Pembayaran

## 19.1 Status pembayaran

| Status | Keterangan |
|---|---|
| UNPAID | Belum ada pembayaran |
| PROOF_UPLOADED | Bukti sudah diunggah |
| PENDING_REVIEW | Menunggu pemeriksaan admin |
| PAID | Pembayaran diterima |
| REJECTED | Bukti ditolak |
| EXPIRED | Batas pembayaran habis |
| REFUNDED | Dana dikembalikan |
| CANCELLED | Pembayaran dibatalkan |

## 19.2 Status pesanan

| Status | Keterangan |
|---|---|
| DRAFT | Belum diselesaikan |
| WAITING_PAYMENT | Menunggu pembayaran |
| CONFIRMED | Pembayaran diterima |
| IN_PRODUCTION | Sedang dibuat |
| READY_FOR_PICKUP | Siap diambil |
| READY_FOR_DELIVERY | Siap dikirim |
| ON_DELIVERY | Dalam pengiriman |
| COMPLETED | Selesai |
| CANCELLED | Dibatalkan |

---

## 20. Struktur Data

## 20.1 Sheet `Settings`

Kolom:

- setting_key
- setting_value
- description
- updated_at
- updated_by

## 20.2 Sheet `Menus`

Kolom:

- menu_id
- menu_name
- slug
- category
- short_description
- full_description
- package_contents
- default_price
- unit
- default_opener_minimum
- regular_minimum
- default_capacity
- allergen_note
- image_url
- is_featured
- is_active
- created_at
- updated_at

## 20.3 Sheet `PO_Batches`

Kolom:

- batch_id
- menu_id
- batch_name
- price
- opener_minimum
- regular_minimum
- capacity
- reserved_quantity
- paid_quantity
- start_at
- close_at
- production_date
- delivery_date
- pickup_slots
- status
- opener_order_id
- is_demo
- created_at
- updated_at

## 20.4 Sheet `Customers`

Kolom:

- customer_id
- full_name
- whatsapp
- email
- last_address
- created_at
- updated_at

## 20.5 Sheet `Orders`

Kolom:

- order_id
- order_number
- customer_id
- customer_name_snapshot
- whatsapp_snapshot
- subtotal
- delivery_fee
- grand_total
- fulfillment_method
- delivery_date
- payment_status
- order_status
- payment_deadline
- notes
- is_demo
- created_at
- updated_at

## 20.6 Sheet `Order_Items`

Kolom:

- order_item_id
- order_id
- batch_id
- menu_id
- menu_name_snapshot
- price_snapshot
- unit_snapshot
- quantity
- subtotal
- customer_note

## 20.7 Sheet `Payments`

Kolom:

- payment_id
- order_id
- payment_method
- amount
- proof_url
- payment_status
- submitted_at
- reviewed_at
- reviewed_by
- rejection_reason
- is_demo

## 20.8 Sheet `Deliveries`

Kolom:

- delivery_id
- order_id
- fulfillment_method
- recipient_name
- recipient_phone
- address
- district
- landmark
- map_url
- pickup_slot
- dummy_courier_name
- dummy_vehicle
- dummy_tracking_status
- delivery_fee
- delivery_status
- is_demo

## 20.9 Sheet `Admin_Users`

Kolom:

- admin_id
- full_name
- username
- password_hash
- password_salt
- role
- is_active
- last_login_at
- created_at

## 20.10 Sheet `Activity_Logs`

Kolom:

- log_id
- admin_id
- action
- entity_type
- entity_id
- description
- previous_value
- new_value
- created_at

---

## 21. Arsitektur Teknis MVP

### Frontend

- HTML;
- CSS;
- JavaScript;
- mobile-first responsive layout;
- komponen antarmuka sederhana;
- tanpa framework berat pada versi awal.

### Backend

- Google Apps Script;
- fungsi server untuk validasi;
- pengelolaan sesi admin;
- akses Google Sheets;
- unggah gambar ke Google Drive;
- simulasi notifikasi;
- simulasi integrasi Lalamove.

### Database

- Google Sheets;
- satu spreadsheet utama;
- setiap entitas disimpan pada sheet berbeda;
- ID unik untuk setiap data.

### File

- foto menu dummy dapat disimpan di Google Drive;
- bukti pembayaran dummy dapat menggunakan gambar contoh;
- logo dan aset demo disimpan terpisah.

### Deployment

- Google Apps Script Web App;
- satu deployment untuk prototipe;
- URL publik untuk pelanggan;
- rute admin melalui parameter atau halaman khusus.

---

## 22. Struktur File Project

```text
Backend
├── App.gs
├── Config.gs
├── Router.gs
├── AuthService.gs
├── SessionService.gs
├── MenuService.gs
├── BatchService.gs
├── OrderService.gs
├── PaymentService.gs
├── DeliveryService.gs
├── DashboardService.gs
├── DemoService.gs
├── SpreadsheetRepository.gs
├── DriveRepository.gs
├── Validation.gs
├── Security.gs
├── LockManager.gs
├── AuditLogger.gs
└── Setup.gs

Frontend
├── Index.html
├── Admin.html
├── Styles.html
├── AdminStyles.html
├── AppScripts.html
├── AdminScripts.html
├── Components.html
├── ProductCard.html
├── ProductDetail.html
├── Cart.html
├── Checkout.html
├── OrderSuccess.html
├── OrderTracking.html
├── AdminDashboard.html
├── AdminMenus.html
├── AdminBatches.html
├── AdminOrders.html
├── AdminProduction.html
├── AdminDelivery.html
└── AdminSettings.html
```

---

## 23. Keamanan

Walaupun hanya prototipe, struktur keamanan dasar tetap diterapkan.

### 23.1 Admin

- login diperlukan;
- password tidak disimpan sebagai teks biasa;
- session mempunyai masa berlaku;
- setiap fungsi admin memeriksa session;
- akses admin tidak hanya disembunyikan di frontend;
- percobaan login dapat dibatasi;
- aktivitas sensitif dicatat.

### 23.2 Data pelanggan

- hanya data yang diperlukan yang dikumpulkan;
- nomor WhatsApp tidak ditampilkan di halaman publik;
- tautan bukti pembayaran tidak dapat ditebak;
- data demo diberi penanda.

### 23.3 Validasi

Backend memeriksa:

- status batch;
- minimum pemesanan;
- sisa kapasitas;
- waktu penutupan;
- total harga;
- status pembayaran;
- tanggal pengiriman;
- format nomor telepon;
- data penerima.

### 23.4 Konflik transaksi

Gunakan penguncian proses pada:

- pembuatan nomor pesanan;
- reservasi kapasitas;
- verifikasi pembayaran;
- pembukaan batch;
- pembatalan;
- reset data demo.

---

## 24. Kebutuhan Antarmuka

### 24.1 Tampilan pelanggan

- lebar optimal untuk HP;
- navigasi ringkas;
- kartu produk satu kolom;
- foto rasio konsisten;
- tombol minimal 44 piksel;
- keranjang tetap terlihat;
- teks status tidak hanya mengandalkan warna;
- checkout dibagi dalam beberapa bagian;
- tidak ada formulir yang terlalu panjang.

### 24.2 Tampilan admin

- kartu, bukan tabel lebar;
- navigasi bawah;
- tindakan paling penting terlihat di beranda;
- form memakai input angka dan tanggal bawaan HP;
- konfirmasi untuk tindakan berisiko;
- notifikasi sukses atau gagal yang jelas;
- jumlah langkah seminimal mungkin.

### 24.3 Status warna

| Status | Warna acuan |
|---|---|
| Menunggu pembuka | Kuning |
| Menunggu pembayaran | Oranye muda |
| PO aktif | Hijau |
| Segera tutup | Oranye |
| Kuota habis | Merah |
| Ditutup | Abu-abu |
| Sedang diproduksi | Biru |
| Selesai | Hijau tua |

Warna akhir mengikuti identitas visual Dapur Rini.

---

## 25. Kebutuhan Fungsional

### FR-001 — Menampilkan katalog

Sistem harus menampilkan menu aktif dengan foto, nama, harga, status, dan tanggal pengiriman.

### FR-002 — Filter menu

Pelanggan dapat memfilter menu berdasarkan kategori dan status.

### FR-003 — Detail menu

Sistem harus menyediakan halaman atau modal detail produk.

### FR-004 — Minimum pembuka

Sistem harus mencegah pesanan di bawah minimum pembuka.

### FR-005 — Penguncian batch

Sistem harus menahan pembukaan batch sampai pembayaran pembuka diverifikasi.

### FR-006 — Pembelian satuan

Sistem harus mengizinkan pembelian minimum reguler setelah batch aktif.

### FR-007 — Kapasitas

Sistem harus menolak pesanan yang melebihi sisa kuota.

### FR-008 — Waktu tutup

Sistem harus menutup batch berdasarkan waktu.

### FR-009 — Keranjang

Pelanggan dapat menambah, mengurangi, dan menghapus produk.

### FR-010 — Validasi checkout

Sistem memeriksa ulang harga, status, waktu, dan kapasitas sebelum membuat pesanan.

### FR-011 — Nomor pesanan

Sistem membuat nomor pesanan unik.

Format contoh:

```text
DR-YYMMDD-XXXX
```

### FR-012 — Pembayaran dummy

Pelanggan dapat memilih metode dan mengunggah bukti dummy.

### FR-013 — Verifikasi admin

Admin dapat menerima atau menolak pembayaran.

### FR-014 — Perubahan status batch

Verifikasi pembayaran pembuka harus mengaktifkan batch secara otomatis.

### FR-015 — Pelacakan

Pelanggan dapat melihat status pesanan.

### FR-016 — Kelola menu

Admin dapat menambah, mengubah, dan menonaktifkan menu.

### FR-017 — Kelola batch

Admin dapat membuat, membuka, menutup, dan membatalkan batch.

### FR-018 — Rekap produksi

Sistem menampilkan jumlah produksi berdasarkan pesanan dibayar.

### FR-019 — Pengiriman dummy

Admin dapat mengubah status pengiriman dan melihat simulasi Lalamove.

### FR-020 — Reset data demo

Admin dapat mengembalikan data ke kondisi awal demo.

---

## 26. Kebutuhan Nonfungsional

### NFR-001 — Responsif

Website harus nyaman digunakan pada lebar layar 360 piksel atau lebih.

### NFR-002 — Performa

Halaman utama sebaiknya dapat digunakan tanpa menunggu seluruh gambar beres dimuat.

### NFR-003 — Aksesibilitas

- kontras cukup;
- tombol mudah ditekan;
- status memiliki teks;
- form memiliki label;
- pesan kesalahan dapat dipahami.

### NFR-004 — Konsistensi

Istilah status, tanggal, harga, dan tombol harus konsisten di seluruh halaman.

### NFR-005 — Pemulihan kesalahan

Jika proses gagal, sistem tidak boleh membuat pesanan ganda.

### NFR-006 — Zona waktu

Seluruh tanggal dan waktu menggunakan WIB.

### NFR-007 — Format harga

Gunakan format rupiah tanpa angka desimal.

### NFR-008 — Audit

Perubahan sensitif harus dicatat.

### NFR-009 — Mode demo

Pengguna harus memahami bahwa transaksi dalam prototipe tidak nyata.

---

## 27. Skenario Uji Utama

### Skenario 1 — Membuka PO

1. Batch Ayam Bakar berstatus menunggu pembuka.
2. Pelanggan mencoba memilih 1 porsi.
3. Sistem menolak.
4. Pelanggan memilih 10 porsi.
5. Checkout berhasil.
6. Batch berubah menjadi menunggu pembayaran.
7. Admin memverifikasi pembayaran.
8. Batch berubah menjadi aktif.
9. Pelanggan kedua dapat memesan 1 porsi.

### Skenario 2 — Pembayaran pembuka kedaluwarsa

1. Pemesan pembuka checkout 10 porsi.
2. Pembayaran tidak diselesaikan.
3. Batas waktu habis.
4. Pesanan menjadi kedaluwarsa.
5. Kapasitas dikembalikan.
6. Batch kembali menunggu pemesan pembuka.

### Skenario 3 — Kuota hampir habis

1. Sisa kapasitas 2 porsi.
2. Pelanggan mencoba membeli 3.
3. Sistem menolak dan menunjukkan sisa kuota.
4. Pelanggan mengubah menjadi 2.
5. Checkout berhasil.
6. Batch menjadi habis.

### Skenario 4 — PO ditutup saat checkout

1. Pelanggan menaruh produk ke keranjang sebelum waktu tutup.
2. Pelanggan menyelesaikan checkout setelah waktu tutup.
3. Sistem memeriksa ulang.
4. Sistem menolak dan meminta pelanggan memperbarui keranjang.

### Skenario 5 — Admin menutup semua PO

1. Admin menekan “Tutup semua PO hari ini”.
2. Sistem menampilkan konfirmasi.
3. Admin menyetujui.
4. Seluruh batch aktif untuk tanggal tersebut menjadi ditutup.
5. Pesanan dibayar tetap masuk produksi.

### Skenario 6 — Reset demo

1. Admin membuka pengaturan demo.
2. Admin menekan reset.
3. Sistem meminta konfirmasi dua langkah.
4. Transaksi dummy dihapus.
5. Batch dan transaksi contoh dibuat kembali.

---

## 28. Kriteria Penerimaan MVP

MVP diterima apabila:

- 20 menu dummy tampil dengan benar;
- seluruh status utama dapat diperagakan;
- aturan minimum pembuka bekerja;
- pembayaran pembuka mengaktifkan PO;
- pembayaran kedaluwarsa mengembalikan status;
- pembelian satuan tersedia setelah PO aktif;
- kapasitas tidak dapat terlewati;
- waktu tutup dapat disimulasikan;
- checkout berjalan di HP;
- pengambilan dan pengiriman dummy dapat dipilih;
- admin dapat mengubah menu melalui HP;
- admin dapat membuat batch;
- admin dapat memverifikasi pembayaran;
- rekap produksi menghitung pesanan dibayar;
- data demo dapat direset;
- tidak ada tombol yang melakukan transaksi nyata.

---

## 29. Tahapan Pengembangan

## Fase 1 — Fondasi demo

- struktur spreadsheet;
- setup data dummy;
- katalog;
- status PO;
- detail produk;
- desain mobile.

## Fase 2 — Transaksi

- keranjang;
- checkout;
- nomor pesanan;
- pembayaran dummy;
- pelacakan pesanan.

## Fase 3 — Admin

- login;
- beranda;
- kelola menu;
- kelola batch;
- pesanan;
- verifikasi pembayaran.

## Fase 4 — Operasional

- rekap produksi;
- pengiriman dummy;
- tutup semua PO;
- reset demo;
- activity log.

## Fase 5 — Pengujian

- uji HP;
- uji aturan PO;
- uji kapasitas;
- uji batas waktu;
- uji pengguna awam;
- perbaikan copywriting dan navigasi.

---

## 30. Pengembangan Setelah Demo Disetujui

Prioritas fase produksi:

1. domain resmi;
2. identitas visual final;
3. data menu asli;
4. rekening dan QRIS asli;
5. kebijakan privasi;
6. payment gateway;
7. notifikasi WhatsApp;
8. integrasi Lalamove;
9. penghitungan ongkir;
10. backup dan pemantauan;
11. multi-admin;
12. laporan penjualan.

---

## 31. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Pelanggan tidak memahami pemesan pembuka | Konversi rendah | Gunakan copy singkat dan contoh visual |
| Pesanan pembuka tidak membayar | Batch terkunci | Terapkan batas pembayaran |
| Dua pelanggan mengambil kuota terakhir | Overselling | Gunakan validasi dan lock |
| Admin bingung melihat terlalu banyak status | Operasional lambat | Gunakan istilah sederhana |
| Data demo dianggap nyata | Kesalahpahaman | Tampilkan pita Mode Demo |
| Dashboard terlalu rumit | Klien menolak | Batasi navigasi utama |
| Integrasi eksternal menghambat demo | Proyek terlambat | Gunakan simulasi dahulu |
| Gambar terlalu besar | Website lambat | Kompres dan gunakan lazy loading |
| Spreadsheet diedit manual | Data rusak | Batasi akses dan gunakan dashboard |

---

## 32. Keputusan Produk yang Direkomendasikan

1. Prototipe menggunakan Google Apps Script, Google Sheets, HTML, CSS, dan JavaScript.
2. Sistem diposisikan sebagai web app PO, bukan landing page statis.
3. Produk dan batch PO disimpan sebagai entitas berbeda.
4. MVP hanya mendukung satu tanggal pengiriman dalam satu checkout.
5. Pembayaran dan Lalamove menggunakan simulasi.
6. Dashboard admin memakai kartu dan navigasi bawah.
7. Spreadsheet tidak menjadi antarmuka utama.
8. Semua data demo dapat direset.
9. Integrasi nyata dilakukan setelah alur disetujui klien.
10. Fokus pengujian adalah pemahaman alur, bukan kelengkapan fitur.

---

## 33. Kesimpulan

Dapur Rini harus dirancang sebagai prototipe sistem pre-order makanan rumahan yang sederhana, mobile-friendly, dan mudah dioperasikan melalui HP.

Nilai utama produk bukan hanya pada tampilan katalog, tetapi pada mekanisme berikut:

- minimum pemesan pembuka;
- verifikasi pembayaran sebagai pemicu pembukaan PO;
- pembelian satuan setelah PO aktif;
- batas waktu;
- kapasitas produksi;
- rekap pesanan untuk hari berikutnya;
- dan dashboard yang dapat dipahami orang awam.

Versi demo tidak perlu langsung terhubung dengan pembayaran atau pengiriman nyata. Simulasi yang konsisten sudah cukup untuk memperlihatkan nilai produk, menguji alur bersama klien, dan menjadi dasar pengembangan versi produksi.
