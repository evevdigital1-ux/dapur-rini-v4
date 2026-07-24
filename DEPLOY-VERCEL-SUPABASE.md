# Panduan Deploy Vercel dan Supabase

Panduan ini disusun agar deployment dapat dilakukan tanpa VPS, Docker, Caddy, atau payment gateway.

## 1. Buat project Supabase

1. Masuk ke Supabase.
2. Buat project baru.
3. Pilih region yang dekat dengan pengguna dan region Vercel Function.
4. Simpan password database pada password manager.

## 2. Buat tabel dan bucket

1. Buka Supabase Dashboard.
2. Masuk ke SQL Editor.
3. Buka file `supabase/setup.sql` dari project ini.
4. Salin seluruh isi file.
5. Jalankan query.

Query membuat:

- `app_state`
- `admin_sessions`
- `trusted_devices`
- `audit_events`
- `rate_limits`
- bucket `dapur-rini-public-media`
- bucket `dapur-rini-private-proofs`

Kedua bucket tetap private. Media ditampilkan melalui API aplikasi.

## 3. Ambil DATABASE_URL

1. Klik tombol Connect pada Supabase Dashboard.
2. Pilih Transaction pooler.
3. Gunakan connection string port `6543`.
4. Ganti placeholder password dengan password database.

Simpan sebagai environment variable `DATABASE_URL` di Vercel.

Jangan memakai direct connection IPv6 untuk Vercel. Gunakan pooler transaction mode.

## 4. Ambil Supabase secret key

1. Buka Settings.
2. Buka API Keys.
3. Buat atau salin Secret key server-side.
4. Simpan sebagai `SUPABASE_SECRET_KEY` di Vercel.

Jangan memakai secret key di frontend. Jangan menaruhnya di GitHub. Project ini tidak membutuhkan publishable key karena browser hanya berbicara dengan API Vercel.

## 5. Buat secret aplikasi

Pada komputer lokal:

```bash
npm run generate:secrets
```

Simpan hasilnya sebagai:

- `DAPUR_RINI_ADMIN_PASSWORD`
- `DAPUR_RINI_PASSWORD_SALT`
- `DAPUR_RINI_DEVICE_PIN`

Jangan mengirim nilai tersebut melalui grup chat umum.

## 6. Upload ke GitHub

1. Buat repository private.
2. Upload seluruh isi project.
3. Pastikan `.env` tidak ikut terunggah.
4. Pastikan tidak ada database, bukti transfer, password, atau secret key di repository.

## 7. Import ke Vercel

1. Pilih Add New Project.
2. Pilih repository GitHub.
3. Framework preset: Other.
4. Root directory: folder project ini.
5. Build command: kosong atau default.
6. Output directory: kosong.
7. Install command: `npm install`.

Project memakai `vercel.json` untuk meneruskan seluruh `/api/*` ke satu Vercel Function.

## 8. Masukkan environment variables

Masukkan nilai berikut pada Vercel Project Settings > Environment Variables:

```text
NODE_ENV=production
DAPUR_RINI_OPERATION_MODE=PRODUCTION
DAPUR_RINI_COOKIE_SECURE=true
DATABASE_URL=...
DAPUR_RINI_DB_SSL=require
DAPUR_RINI_DB_POOL_SIZE=1
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=...
SUPABASE_PUBLIC_MEDIA_BUCKET=dapur-rini-public-media
SUPABASE_PRIVATE_PROOF_BUCKET=dapur-rini-private-proofs
DAPUR_RINI_ADMIN_PASSWORD=...
DAPUR_RINI_PASSWORD_SALT=...
DAPUR_RINI_DEVICE_PIN=...
DAPUR_RINI_SESSION_MINUTES=30
DAPUR_RINI_TRUSTED_DEVICE_DAYS=30
```

Terapkan pada Production. Gunakan nilai berbeda untuk Preview jika Preview terhubung ke project Supabase staging.

## 9. Atur region Function

Tempatkan Vercel Function sedekat mungkin dengan region Supabase. Untuk project Supabase di Singapura, gunakan region Vercel Singapore jika opsi tersebut tersedia pada project Anda.

## 10. Deploy dan periksa

Setelah deployment selesai, buka:

```text
https://DOMAIN/api/health
https://DOMAIN/api/readiness
```

`/api/health` harus mengembalikan `ok: true`.

Pada deployment pertama, `/api/readiness` mungkin mengembalikan 503 karena rekening atau QRIS belum diatur. Ini normal.

## 11. Konfigurasi usaha

1. Buka `https://DOMAIN/?view=admin`.
2. Login dengan username `admin` dan password production.
3. Masukkan PIN perangkat ketika diminta.
4. Buka Pengaturan.
5. Isi rekening transfer atau unggah QRIS.
6. Atur kontak usaha.
7. Atur menu, foto, harga, kapasitas, dan jadwal batch.
8. Buka kembali `/api/readiness`.

Jangan membuka PO sebelum informasi pembayaran sudah benar.

## 12. Uji transaksi

Lakukan minimal lima skenario:

1. Pesanan transfer bank dan bukti valid.
2. Pesanan QRIS dan bukti valid.
3. Bukti belum ditemukan pada rekening.
4. Pesanan kedaluwarsa.
5. Pembayaran terlambat atau refund.

Gunakan nominal kecil pada pilot awal.

## 13. Domain

Domain bawaan `vercel.app` dapat digunakan lebih dahulu. Domain khusus dapat ditambahkan kemudian melalui Vercel Project Settings > Domains.

## 14. Backup

Backup tidak dijalankan otomatis oleh Vercel Function. Jalankan dari komputer operator:

```bash
npm run backup:supabase -- ./backup-dapur-rini
```

Simpan hasil backup di media lain. Jangan hanya menyimpannya pada laptop yang sama.

## 15. Jika deployment gagal

Periksa urutan berikut:

1. `supabase/setup.sql` sudah dijalankan.
2. `DATABASE_URL` memakai pooler port 6543.
3. Password pada URL benar.
4. `DAPUR_RINI_DB_SSL=require`.
5. `SUPABASE_URL` benar.
6. `SUPABASE_SECRET_KEY` merupakan secret server-side.
7. Nama bucket sama dengan environment variable.
8. Deployment sudah diulang setelah environment variable diubah.
