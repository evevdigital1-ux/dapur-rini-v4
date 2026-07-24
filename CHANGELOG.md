# Changelog

## 4.0.0

- Mengganti deployment VPS menjadi Vercel Functions.
- Menggunakan Supabase PostgreSQL melalui transaction pooler.
- Menggunakan Supabase Storage untuk QRIS, testimoni, dan bukti pembayaran.
- Memindahkan rate limit ke PostgreSQL.
- Menghapus ketergantungan pada filesystem production dan timer permanen.
- Menambahkan routing `/api/*` melalui satu Vercel Function.
- Menambahkan SQL setup Supabase, environment template, backup, restore, dan panduan deployment.
- Mempertahankan mode file lokal untuk automated test dan pengembangan.
