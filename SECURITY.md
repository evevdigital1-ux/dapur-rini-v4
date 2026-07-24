# Keamanan Dapur Rini v4.0

## Pemisahan akses

Browser tidak terhubung langsung ke Supabase. Semua permintaan melewati API Vercel. `SUPABASE_SECRET_KEY` hanya tersedia pada environment variable server-side.

Tabel aplikasi mengaktifkan Row Level Security dan mencabut akses dari role `anon` serta `authenticated`. Koneksi backend memakai `DATABASE_URL` server-side.

## Bukti pembayaran

- Bucket bukti pembayaran bersifat private.
- Akses file memerlukan sesi admin.
- File hanya menerima PNG, JPEG, atau WebP.
- Ukuran maksimal 1,5 MB.
- Magic bytes diperiksa.
- Nama file dibuat acak.
- Bukti lama dihapus setelah bukti baru berhasil disimpan.

Bukti pembayaran bukan dasar tunggal. Pemilik harus mencocokkan dana pada aplikasi bank atau QRIS.

## Autentikasi admin

- Password diproses dengan `scrypt`.
- Session token disimpan sebagai hash SHA-256.
- Cookie memakai HttpOnly, Secure, dan SameSite Strict pada production.
- CSRF token wajib untuk mutasi admin.
- PIN perangkat diminta pada perangkat baru.
- Sesi dan perangkat tepercaya disimpan di PostgreSQL.

## Rate limit

Rate limit tersimpan di PostgreSQL dan berlaku lintas Vercel Function untuk:

- login;
- checkout;
- pelacakan pesanan;
- unggah bukti pembayaran.

## Secret yang wajib dijaga

- `DATABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DAPUR_RINI_ADMIN_PASSWORD`
- `DAPUR_RINI_PASSWORD_SALT`
- `DAPUR_RINI_DEVICE_PIN`

Jangan memasukkan secret ke source code, frontend, GitHub, URL, screenshot, atau log.

## Batasan

- Belum ada antivirus eksternal untuk unggahan.
- PIN perangkat bukan MFA authenticator.
- Satu akun admin masih digunakan.
- State bisnis masih berupa satu dokumen JSONB.
- Ketersediaan mengikuti batas dan status layanan Vercel serta Supabase.
