# Supabase

Jalankan `setup.sql` satu kali melalui SQL Editor sebelum deployment pertama.

Aplikasi akan membuat state production kosong ketika tabel tersedia tetapi baris `app_state` belum ada.

Gunakan:

- Transaction pooler port 6543 untuk `DATABASE_URL`.
- Secret key server-side untuk `SUPABASE_SECRET_KEY`.
- Bucket default yang dibuat oleh `setup.sql`.

Jangan memberikan akses publik pada bucket bukti pembayaran.
