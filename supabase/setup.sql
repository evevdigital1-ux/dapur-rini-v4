-- Dapur Rini v4.0 - Supabase setup
-- Jalankan satu kali melalui Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS public.app_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  payload JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  device_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON public.admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS public.trusted_devices (
  device_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trusted_devices_expiry_idx ON public.trusted_devices (expires_at);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  revision BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_events_at_idx ON public.audit_events (at DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON public.audit_events (action);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  limit_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx ON public.rate_limits (expires_at);

-- Aplikasi hanya mengakses tabel melalui koneksi server-side DATABASE_URL.
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_state FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.trusted_devices FROM anon, authenticated;
REVOKE ALL ON TABLE public.audit_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.audit_events_id_seq FROM anon, authenticated;

-- Bucket tetap private. Media QRIS/testimoni disajikan melalui endpoint aplikasi.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('dapur-rini-public-media', 'dapur-rini-public-media', false, 1572864, ARRAY['image/png','image/jpeg','image/webp']),
  ('dapur-rini-private-proofs', 'dapur-rini-private-proofs', false, 1572864, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
