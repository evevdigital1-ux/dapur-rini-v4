# UAT Pilot Transaksi Dapur Rini

## Persiapan

- Gunakan domain staging atau production yang sudah HTTPS.
- Gunakan satu menu dan satu tanggal produksi.
- Batasi pelanggan pilot.
- Pastikan rekening dan QRIS benar.
- Pastikan backup telah dibuat.
- Jalankan `/api/readiness` dan pastikan HTTP 200.

## Skenario pelanggan

1. Membuat pesanan transfer bank.
2. Membuat pesanan QRIS statis.
3. Membuat pesanan tunai pickup.
4. Mengunggah bukti yang valid.
5. Mengunggah bukti baru setelah diminta.
6. Melacak pesanan dengan kode dan telepon.
7. Mencoba melacak dengan telepon yang salah.
8. Membiarkan pesanan melewati batas pembayaran.

## Skenario pemilik

1. Login dari HP utama.
2. Login dari perangkat baru menggunakan PIN perangkat.
3. Menerima pembayaran.
4. Memilih Belum masuk.
5. Meminta bukti baru dan membuka WhatsApp.
6. Menangani pembayaran terlambat.
7. Menandai refund diperlukan dan selesai.
8. Melihat rekap produksi per tanggal.
9. Menandai pesanan sedang dibuat.
10. Menandai pesanan siap diambil atau dikirim.
11. Menyelesaikan pesanan tunai dan memeriksa penerimaan harian.
12. Menutup seluruh PO.

## Skenario teknis

1. Jalankan dua checkout pada kuota terakhir secara bersamaan.
2. Restart container aplikasi dan pastikan pesanan tetap ada.
3. Restart PostgreSQL dan periksa pemulihan koneksi.
4. Pastikan bukti pembayaran tidak dapat dibuka tanpa login admin.
5. Pastikan reset tidak tersedia pada mode produksi.
6. Jalankan backup.
7. Pulihkan backup pada staging.
8. Periksa audit log.
9. Periksa health dan readiness.
10. Uji pada lebar layar 360, 390, dan 430 piksel.

## Kriteria lulus

- Tidak ada overselling.
- Tidak ada pesanan hilang.
- Pemilik dapat menjalankan alur tanpa bantuan teknis.
- Satu pembayaran dapat diputuskan maksimal tiga langkah.
- Rekap produksi sesuai pesanan yang harus dibuat.
- Pembayaran tunai belum dihitung sebelum pesanan selesai.
- Bukti pembayaran tetap privat.
- Backup dapat dipulihkan.
- Tidak ada error kritis pada log.
