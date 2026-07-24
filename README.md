# Dapur Rini Vercel + Supabase v4.0

Aplikasi pre-order makanan rumahan dengan pembayaran manual. Deployment utama memakai Vercel Functions, Supabase PostgreSQL, dan Supabase Storage. Sistem tidak memakai payment gateway, integrasi bank, atau impor mutasi CSV.

## Arsitektur

```text
Pelanggan dan Pemilik
        │
        ▼
Vercel
├── index.html dan assets
└── /api melalui Vercel Function
        │
        ├── Supabase PostgreSQL
        └── Supabase Storage private
```

Data pesanan, sesi admin, trusted device, audit log, dan rate limit disimpan di PostgreSQL. QRIS, foto testimoni, dan bukti pembayaran disimpan di Supabase Storage. Secret key Supabase hanya digunakan di server.

## Fitur utama

- Transfer bank manual, QRIS statis, dan tunai saat pickup.
- Upload bukti pembayaran maksimal 1,5 MB.
- Bukti pembayaran hanya dapat dibuka melalui sesi admin.
- Checkout serializable untuk mencegah lost update dan overselling.
- Nomor pesanan unik `DR-YYMMDD-XXXX`.
- Reservasi kuota dan kedaluwarsa saat request.
- Session cookie HttpOnly, Secure, dan SameSite Strict.
- CSRF protection.
- Verifikasi perangkat admin dengan PIN.
- Rate limit PostgreSQL untuk login, checkout, tracking, dan upload.
- Audit log.
- Health dan readiness endpoint.
- Backup dan restore manual untuk Supabase.

## Deployment cepat

1. Buat project Supabase.
2. Jalankan `supabase/setup.sql` melalui SQL Editor.
3. Siapkan repository GitHub private.
4. Import repository ke Vercel.
5. Masukkan seluruh environment variable dari `.env.example`.
6. Deploy.
7. Buka `/api/health` dan `/api/readiness`.
8. Login melalui `/?view=admin`.
9. Isi rekening atau unggah QRIS, lalu atur menu dan batch.
10. Pastikan `/api/readiness` mengembalikan HTTP 200 sebelum transaksi nyata.

Panduan rinci tersedia pada `DEPLOY-VERCEL-SUPABASE.md`.

## Menjalankan secara lokal

Mode lokal menggunakan file agar pengujian tidak memerlukan akun Supabase.

```bash
npm start
```

Buka `http://127.0.0.1:8080`.

Kredensial lokal:

```text
username: admin
password: rini123
```

Jangan gunakan kredensial bawaan pada deployment publik.

## Pengujian

```bash
npm run check
npm test
```

## Backup Supabase

Jalankan dari komputer operator yang memiliki environment variable production:

```bash
npm run backup:supabase -- ./backup-dapur-rini
```

Pemulihan:

```bash
npm run restore:supabase -- ./backup-dapur-rini --confirm
```

Pemulihan bersifat destruktif. Uji terlebih dahulu pada project Supabase staging.

## Batasan

- Arsitektur bisnis masih menggunakan satu dokumen JSONB yang dikunci per transaksi. Ini sesuai untuk pilot dan volume rendah sampai menengah.
- Bukti pembayaran diverifikasi manual oleh pemilik.
- Tidak ada antivirus eksternal untuk file unggahan.
- Tidak ada sinkronisasi otomatis dengan bank atau QRIS.
- Vercel dan Supabase tetap memiliki kuota serta batas layanan masing-masing.
