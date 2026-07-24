# Pengujian Dapur Rini v4.0

## Perintah lokal

```bash
npm run check
npm test
```

Mode lokal menggunakan file dan tidak memerlukan akun Supabase.

## Cakupan otomatis

- public state tidak membocorkan pesanan;
- login, cookie HttpOnly, session, dan CSRF;
- checkout paralel dan nomor pesanan unik;
- tracking dengan kode dan telepon;
- perlindungan static file;
- bukti pembayaran privat;
- state machine batch;
- invarians kapasitas;
- multi-batch;
- pembayaran manual, pembayaran terlambat, tunai pickup, dan refund;
- seed produksi tanpa data contoh;
- frontend tidak menyimpan state bisnis di localStorage;
- struktur Vercel Function dan rewrite API;
- SQL setup Supabase, RLS, bucket private, dan rate limit database;
- tidak ada timer permanen pada backend serverless.

## Pengujian staging yang wajib

Automated test lokal tidak menggantikan:

- koneksi nyata ke Supabase Transaction pooler;
- upload dan download Supabase Storage;
- deployment Vercel;
- environment variables production;
- tampilan pada HP pemilik;
- rekening dan QRIS asli;
- jaringan seluler lambat;
- backup dan restore project staging;
- kuota Vercel dan Supabase.

Gunakan `docs/UAT-PILOT.md`.

## Kriteria rilis

- `npm run check` lulus.
- `npm test` lulus.
- `/api/health` HTTP 200.
- `/api/readiness` HTTP 200.
- Backup dan restore staging lulus.
- UAT pemilik lulus.
- Pilot kecil selesai tanpa overselling atau kehilangan pesanan.
