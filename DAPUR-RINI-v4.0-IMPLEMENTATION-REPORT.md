# Laporan Implementasi Dapur Rini v4.0

Tanggal: 24 Juli 2026
Target: Vercel Functions + Supabase PostgreSQL + Supabase Storage

## Ringkasan

Project Dapur Rini v3.0 telah direfaktor menjadi aplikasi serverless yang dapat dideploy melalui Vercel. Supabase menjadi sumber kebenaran untuk data transaksi, sesi admin, trusted device, audit log, rate limit, dan file gambar.

Alur bisnis tetap menggunakan pembayaran manual. Sistem tidak memakai payment gateway, integrasi rekening bank, atau impor mutasi CSV.

## Perubahan arsitektur

### Vercel

- Frontend publik dipindahkan ke folder `public/`.
- Seluruh endpoint `/api/*` diteruskan ke satu Vercel Function melalui `api/index.js`.
- Tidak ada proses server permanen.
- Tidak ada `setInterval` untuk expiry atau maintenance.
- Expiry dan pembersihan ringan diproses saat request relevan.
- Deployment production ditolak dengan HTTP 503 jika database atau Supabase Storage belum dikonfigurasi.
- Header CSP, HSTS, anti-framing, MIME protection, referrer policy, dan permissions policy diterapkan.

### Supabase PostgreSQL

Tabel yang digunakan:

- `app_state`
- `admin_sessions`
- `trusted_devices`
- `audit_events`
- `rate_limits`

Perubahan penting:

- Checkout dan perubahan state memakai transaksi serializable.
- State dikunci saat transaksi untuk mencegah lost update dan overselling.
- Session admin tidak disimpan di memori Function.
- Rate limit tidak disimpan di memori Function.
- RLS diaktifkan dan akses `anon` serta `authenticated` dicabut dari tabel internal.
- Koneksi disiapkan untuk Transaction Pooler dengan pool kecil yang sesuai untuk serverless.

### Supabase Storage

Dua bucket private digunakan:

- `dapur-rini-public-media`
- `dapur-rini-private-proofs`

Bucket pertama menyimpan QRIS dan gambar testimoni. File tetap disajikan melalui endpoint aplikasi. Bucket kedua menyimpan bukti transfer dan hanya dapat dibuka melalui sesi admin yang valid.

Validasi file:

- PNG, JPEG, atau WebP.
- Maksimal 1,5 MB.
- MIME type dan magic bytes diperiksa.
- Secret key Supabase hanya berada pada server.

## Perubahan operasional

- Backup Supabase mencakup state, audit event, media publik, dan bukti pembayaran.
- Setiap file backup memiliki checksum SHA-256.
- Restore memvalidasi checksum.
- Restore memulihkan file Storage terlebih dahulu. Database baru diganti setelah seluruh file berhasil.
- Readiness endpoint memeriksa database, Storage, mode produksi, cookie aman, password, salt, PIN perangkat, data demo, dan konfigurasi pembayaran.

## Berkas deployment utama

- `vercel.json`
- `api/index.js`
- `supabase/setup.sql`
- `.env.example`
- `DEPLOY-VERCEL-SUPABASE.md`
- `scripts/backup-supabase.js`
- `scripts/restore-supabase.js`

## Hasil pengujian

- Pemeriksaan sintaks JavaScript: lulus.
- Automated tests: 39 dari 39 lulus.
- Checkout paralel: lulus.
- Privasi state publik: lulus.
- Session dan CSRF: lulus.
- Rate limit: lulus.
- Bukti pembayaran privat: lulus.
- QRIS melalui storage adapter: lulus.
- Vercel rewrite: lulus.
- Header keamanan Vercel: lulus.
- SQL Supabase dan bucket private: lulus.
- Adapter Supabase Storage dengan mock: lulus.

## Batas validasi

Deployment nyata belum dijalankan karena kredensial Vercel dan Supabase tidak tersedia dalam lingkungan implementasi. PostgreSQL Supabase dan Storage Supabase belum diuji terhadap project live. Pengujian integrasi Storage menggunakan adapter mock.

Akses registry npm mengalami timeout. Karena itu, `package-lock.json` tidak dapat dibuat dan proses instalasi dependency melalui Vercel belum diverifikasi dalam lingkungan ini. Vercel akan menjalankan `npm install` saat deployment.

## Status

Status source: siap diunggah ke repository GitHub private dan dideploy ke environment staging Vercel.

Status transaksi nyata: aktifkan hanya setelah `supabase/setup.sql` berhasil, seluruh environment variable terpasang, `/api/readiness` mengembalikan HTTP 200, transaksi pilot berhasil, dan backup serta restore telah diuji pada project staging.
