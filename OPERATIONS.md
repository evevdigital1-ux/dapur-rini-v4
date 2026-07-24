# Operasi Dapur Rini v4.0

## Peran pemilik

Pemilik hanya menjalankan kegiatan berikut dari dashboard:

1. Memeriksa pembayaran.
2. Melihat produksi.
3. Mengelola pesanan.
4. Mengatur rekening, QRIS, menu, dan batch.
5. Menindaklanjuti pembayaran bermasalah atau refund.

Pemilik tidak perlu membuka Supabase atau Vercel untuk kegiatan harian.

## Peran operator teknis

Operator mengelola:

- environment variables;
- deployment Vercel;
- project Supabase;
- backup dan restore;
- pemeriksaan error;
- rotasi secret;
- pembaruan aplikasi.

## Pemeriksaan rutin

Periksa:

```text
/api/health
/api/readiness
```

`/api/readiness` memeriksa database, Supabase Storage, mode produksi, secure cookie, password, salt, PIN perangkat, data demo, serta konfigurasi pembayaran manual.

## Backup

Jalankan pada komputer operator:

```bash
npm run backup:supabase -- ./backup-dapur-rini
```

Backup mencakup state bisnis, audit event, media publik, dan bukti pembayaran. Sesi admin, trusted device, serta rate limit tidak dipulihkan karena bersifat sementara.

## Restore drill

1. Buat project Supabase staging.
2. Jalankan `supabase/setup.sql`.
3. Atur environment variable staging.
4. Jalankan:

```bash
npm run restore:supabase -- ./backup-dapur-rini --confirm
```

5. Uji login, pesanan, QRIS, bukti pembayaran, dan checkout.

## Insiden

### Aplikasi tidak dapat dibuka

- Periksa status deployment pada Vercel.
- Periksa Function Logs.
- Periksa `/api/health`.
- Periksa status project Supabase.
- Jangan membuat project database baru sebelum memastikan data lama tersedia.

### Database gagal terhubung

- Periksa `DATABASE_URL`.
- Pastikan URL memakai Transaction pooler port 6543.
- Pastikan `DAPUR_RINI_DB_SSL=require`.
- Redeploy setelah environment variable diubah.

### Bukti pembayaran tidak tampil

- Periksa nama bucket.
- Periksa `SUPABASE_SECRET_KEY`.
- Periksa Storage Logs pada Supabase.
- Jangan meminta pelanggan mengirim bukti ke kanal publik.

### Akun admin diduga bocor

- Ganti password admin, salt, dan PIN.
- Hapus isi tabel `admin_sessions` dan `trusted_devices` melalui SQL Editor.
- Tinjau `audit_events`.
- Periksa perubahan rekening, QRIS, harga, batch, dan status pembayaran.
