'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const BUCKETS = [
  String(process.env.SUPABASE_PUBLIC_MEDIA_BUCKET || 'dapur-rini-public-media'),
  String(process.env.SUPABASE_PRIVATE_PROOF_BUCKET || 'dapur-rini-private-proofs')
];

function required(value, name) {
  if (!value) throw new Error(`${name} belum diatur.`);
  return value;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function listAll(client, bucket) {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Gagal membaca bucket ${bucket}: ${error.message}`);
    const page = (data || []).filter((item) => item.name && item.id);
    files.push(...page);
    if (page.length < 1000) return files;
  }
}

async function main() {
  required(DATABASE_URL, 'DATABASE_URL');
  required(SUPABASE_URL, 'SUPABASE_URL');
  required(SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY');
  const target = path.resolve(process.argv[2] || `backup-supabase-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });

  const pool = new Pool({ connectionString: DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false }, allowExitOnIdle: true });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const manifest = { format: 'dapur-rini-supabase-backup-v1', createdAt: new Date().toISOString(), files: {} };

  try {
    const [state, audit] = await Promise.all([
      pool.query('SELECT payload, revision, updated_at FROM app_state WHERE id=1'),
      pool.query('SELECT id, at, action, actor, detail, revision, metadata FROM audit_events ORDER BY id')
    ]);
    if (!state.rowCount) throw new Error('State aplikasi tidak ditemukan.');
    const databasePayload = Buffer.from(`${JSON.stringify({ appState: state.rows[0], auditEvents: audit.rows }, null, 2)}\n`);
    fs.writeFileSync(path.join(target, 'database.json'), databasePayload, { mode: 0o600 });
    manifest.files['database.json'] = sha256(databasePayload);

    for (const bucket of BUCKETS) {
      const bucketDir = path.join(target, 'storage', bucket);
      fs.mkdirSync(bucketDir, { recursive: true, mode: 0o700 });
      for (const file of await listAll(supabase, bucket)) {
        const { data, error } = await supabase.storage.from(bucket).download(file.name);
        if (error || !data) throw new Error(`Gagal mengunduh ${bucket}/${file.name}: ${error?.message || 'file kosong'}`);
        const buffer = Buffer.from(await data.arrayBuffer());
        const filepath = path.join(bucketDir, path.basename(file.name));
        fs.writeFileSync(filepath, buffer, { mode: 0o600 });
        manifest.files[`storage/${bucket}/${path.basename(file.name)}`] = sha256(buffer);
      }
    }

    const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(target, 'manifest.json'), manifestBuffer, { mode: 0o600 });
    console.log(`Backup selesai: ${target}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
