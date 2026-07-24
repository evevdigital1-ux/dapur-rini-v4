# SOP Pembayaran Manual

## Tujuan

Memastikan setiap pembayaran diterima berdasarkan dana yang benar-benar masuk, bukan hanya berdasarkan foto bukti.

## Transfer bank dan QRIS statis

1. Pelanggan membuat pesanan.
2. Sistem menahan kuota sampai batas pembayaran.
3. Pelanggan membayar dan mengunggah bukti.
4. Pesanan masuk daftar **Perlu dicek**.
5. Pemilik membuka aplikasi bank atau QRIS.
6. Pemilik mencocokkan nama, nominal, dan waktu.
7. Pemilik memilih keputusan.

### Pembayaran diterima

Gunakan ketika dana sudah terlihat dan nominal sesuai. Sistem memindahkan kuota tertahan menjadi terjual dan memasukkan pesanan ke produksi.

### Belum masuk

Gunakan ketika bukti sudah ada tetapi dana belum terlihat. Pesanan masuk daftar **Cek lagi**. Kuota tetap ditahan sampai batas pembayaran berakhir.

### Minta bukti baru

Gunakan ketika gambar buram, nominal tidak terlihat, nama pengirim tidak terlihat, atau bukti tidak sesuai. Sistem menyiapkan pesan WhatsApp untuk pelanggan.

### Masalah pembayaran

Gunakan untuk:

- pembayaran kurang;
- pembayaran lebih;
- nama pengirim berbeda;
- transaksi tidak ditemukan;
- pembayaran masuk setelah pesanan kedaluwarsa.

Keputusan tersedia:

- minta penjelasan atau bukti baru;
- batalkan pesanan;
- tandai dana perlu dikembalikan.

## Tunai saat pickup

Pesanan langsung masuk produksi dengan status **Bayar saat pickup**. Uang belum dihitung sebagai penerimaan. Setelah pelanggan membayar dan menerima pesanan, tandai pesanan **Selesai**.

## Pembayaran terlambat

Jika bukti dikirim setelah kuota dilepas:

1. Periksa dana.
2. Periksa kapasitas produksi.
3. Terima hanya jika pesanan masih dapat dipenuhi.
4. Jika tidak dapat dipenuhi, tandai dana perlu dikembalikan.

## Refund manual

1. Periksa jumlah yang harus dikembalikan.
2. Transfer dana melalui aplikasi bank atau QRIS.
3. Simpan bukti transfer jika diperlukan.
4. Tekan **Dana sudah dikembalikan**.
5. Isi catatan singkat.

## Larangan

- Jangan menerima pembayaran hanya dari screenshot.
- Jangan menghapus pesanan bermasalah.
- Jangan menggunakan satu password bersama orang lain.
- Jangan menyimpan bukti pembayaran di grup WhatsApp umum.
