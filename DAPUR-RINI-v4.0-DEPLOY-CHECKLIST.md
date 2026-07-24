# Checklist Deploy Dapur Rini v4.0

## A. Supabase

- [ ] Project Supabase dibuat.
- [ ] Region dipilih dekat dengan pengguna dan Vercel Function.
- [ ] Password database disimpan dalam password manager.
- [ ] Seluruh isi `supabase/setup.sql` dijalankan melalui SQL Editor.
- [ ] Tabel `app_state`, `admin_sessions`, `trusted_devices`, `audit_events`, dan `rate_limits` tersedia.
- [ ] Bucket `dapur-rini-public-media` tersedia dan private.
- [ ] Bucket `dapur-rini-private-proofs` tersedia dan private.
- [ ] Transaction Pooler connection string port 6543 diperoleh.
- [ ] Supabase server-side secret key diperoleh.

## B. Secret aplikasi

- [ ] Jalankan `npm run generate:secrets` pada komputer lokal.
- [ ] Password admin minimal 12 karakter dan unik.
- [ ] Password salt minimal 16 karakter dan acak.
- [ ] PIN perangkat berisi minimal 6 digit dan bukan `654321`.
- [ ] Secret tidak dikirim melalui grup chat umum.
- [ ] Secret tidak disimpan di repository.

## C. GitHub

- [ ] Repository dibuat private.
- [ ] Folder `node_modules` tidak diunggah.
- [ ] File `.env` tidak diunggah.
- [ ] Tidak ada password, database dump, bukti transfer, atau data pelanggan.
- [ ] Source v4.0 berhasil di-push.

## D. Vercel

- [ ] Repository diimpor ke Vercel.
- [ ] Framework preset menggunakan Other.
- [ ] Root directory benar.
- [ ] Environment variable berikut telah dimasukkan:
  - [ ] `NODE_ENV=production`
  - [ ] `DAPUR_RINI_OPERATION_MODE=PRODUCTION`
  - [ ] `DAPUR_RINI_COOKIE_SECURE=true`
  - [ ] `DATABASE_URL`
  - [ ] `DAPUR_RINI_DB_SSL=require`
  - [ ] `DAPUR_RINI_DB_POOL_SIZE=1`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SECRET_KEY`
  - [ ] `SUPABASE_PUBLIC_MEDIA_BUCKET=dapur-rini-public-media`
  - [ ] `SUPABASE_PRIVATE_PROOF_BUCKET=dapur-rini-private-proofs`
  - [ ] `DAPUR_RINI_ADMIN_PASSWORD`
  - [ ] `DAPUR_RINI_PASSWORD_SALT`
  - [ ] `DAPUR_RINI_DEVICE_PIN`
  - [ ] `DAPUR_RINI_SESSION_MINUTES=30`
  - [ ] `DAPUR_RINI_TRUSTED_DEVICE_DAYS=30`
- [ ] Preview tidak memakai database production, atau Preview dinonaktifkan untuk transaksi.
- [ ] Deployment berhasil.

## E. Pemeriksaan teknis

- [ ] `/api/health` mengembalikan HTTP 200 dan `ok: true`.
- [ ] `/api/readiness` dapat dibuka.
- [ ] Login admin berhasil.
- [ ] PIN perangkat berhasil.
- [ ] Rekening atau QRIS nyata telah diatur.
- [ ] `/api/readiness` mengembalikan HTTP 200.
- [ ] Bukti transfer tidak dapat dibuka tanpa login admin.
- [ ] Bukti transfer dapat dibuka setelah login admin.
- [ ] QRIS tampil pada halaman pelanggan.
- [ ] Logout menghapus sesi admin.

## F. Pilot transaksi

- [ ] Pesanan transfer bank berhasil dibuat.
- [ ] Pesanan QRIS berhasil dibuat.
- [ ] Bukti pembayaran berhasil diunggah.
- [ ] Pemilik dapat memilih Pembayaran diterima.
- [ ] Pemilik dapat memilih Belum masuk.
- [ ] Pemilik dapat memilih Minta bukti baru.
- [ ] Pesanan kedaluwarsa melepaskan kuota.
- [ ] Pembayaran terlambat mengikuti keputusan pemilik.
- [ ] Refund manual dapat dicatat.
- [ ] Pesanan tunai pickup tidak dihitung sebagai pendapatan sebelum selesai.
- [ ] Dua checkout bersamaan tidak menyebabkan overselling.

## G. Backup dan pemulihan

- [ ] Backup dibuat dengan `npm run backup:supabase -- ./backup-dapur-rini`.
- [ ] Backup disalin ke media terpisah.
- [ ] Checksum backup berhasil diverifikasi.
- [ ] Restore diuji pada project Supabase staging.
- [ ] Hasil restore sesuai dengan data sumber.

## H. Go-live

- [ ] Menu, harga, kapasitas, tanggal, rekening, dan QRIS telah diperiksa pemilik.
- [ ] Kebijakan privasi diterbitkan.
- [ ] Ketentuan transaksi dan pembatalan diterbitkan.
- [ ] Nomor WhatsApp usaha benar.
- [ ] Pemilik menjalankan UAT melalui HP yang digunakan sehari-hari.
- [ ] Pilot nominal kecil selesai tanpa selisih.
- [ ] Pemilik memahami SOP pembayaran, expiry, dan refund.
