# Checklist Go-Live Dapur Rini

Semua kotak harus dicentang sebelum transaksi nyata dibuka.

## Teknis

- [ ] Domain resmi mengarah ke server.
- [ ] HTTPS aktif tanpa peringatan sertifikat.
- [ ] PostgreSQL aktif dan memiliki volume persisten.
- [ ] `/api/health` mengembalikan HTTP 200.
- [ ] `/api/readiness` mengembalikan HTTP 200.
- [ ] Password admin sudah diganti dan minimal 12 karakter.
- [ ] Salt dan PIN perangkat menggunakan nilai unik.
- [ ] Reset data tidak tersedia pada mode produksi.
- [ ] Bukti pembayaran tidak dapat dibuka tanpa login admin.
- [ ] Backup produksi berhasil dibuat.
- [ ] Backup berhasil dipulihkan pada staging.
- [ ] Log tidak menunjukkan error berulang.

## Usaha

- [ ] Nama, nomor WhatsApp, dan alamat pickup sudah benar.
- [ ] Rekening transfer sudah benar.
- [ ] QRIS statis sudah benar, jika digunakan.
- [ ] Harga, foto, unit, kapasitas, dan tanggal PO sudah benar.
- [ ] Aturan pembayaran tunai pickup sudah diputuskan.
- [ ] Kebijakan privasi sudah ditinjau dan diterbitkan.
- [ ] Syarat transaksi, pembatalan, dan refund sudah ditinjau dan diterbitkan.

## UAT pemilik

- [ ] Pemilik dapat login dari HP utama.
- [ ] Pemilik dapat login dari perangkat baru dengan PIN.
- [ ] Pemilik dapat menerima pembayaran dalam maksimal tiga langkah.
- [ ] Pemilik dapat memilih Belum masuk.
- [ ] Pemilik dapat meminta bukti baru dan membuka WhatsApp.
- [ ] Pemilik dapat menangani pembayaran terlambat.
- [ ] Pemilik dapat mencatat refund.
- [ ] Pemilik dapat membaca rekap produksi.
- [ ] Pemilik dapat menyelesaikan pesanan tunai.

## Pilot

- [ ] Pilot memakai satu menu dan satu tanggal produksi.
- [ ] Jumlah pelanggan pilot dibatasi.
- [ ] Dua checkout pada kuota terakhir tidak menyebabkan overselling.
- [ ] Tidak ada pesanan hilang setelah restart aplikasi.
- [ ] Nilai pembayaran sesuai pemeriksaan pemilik.
- [ ] Rekap produksi sesuai pesanan yang harus dibuat.
- [ ] Masalah pilot dicatat dan seluruh temuan kritis ditutup.
