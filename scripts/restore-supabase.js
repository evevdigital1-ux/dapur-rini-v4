'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function required(value, name) { if (!value) throw new Error(`${name} belum diatur.`); return value; }

async function main() {
  const source = path.resolve(process.argv[2] || '');
  if (!source || !fs.existsSync(source)) throw new Error('Folder backup tidak ditemukan.');
  if (!process.argv.includes('--confirm')) throw new Error('Pemulihan bersifat destruktif. Jalankan ulang dengan --confirm.');
  required(DATABASE_URL, 'DATABASE_URL');
  required(SUPABASE_URL, 'SUPABASE_URL');
  required(SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY');

  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'dapur-rini-supabase-backup-v1') throw new Error('Format backup tidak dikenali.');
  for (const [relative, expected] of Object.entries(manifest.files || {})) {
    const buffer = fs.readFileSync(path.join(source, relative));
    if (sha256(buffer) !== expected) throw new Error(`Checksum tidak cocok: ${relative}`);
  }

  const backup = JSON.parse(fs.readFileSync(path.join(source, 'database.json'), 'utf8'));
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false }, allowExitOnIdle: true });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    // Pulihkan objek terlebih dahulu. Database baru diganti setelah semua file lolos.
    const storageRoot = path.join(source, 'storage');
    if (fs.existsSync(storageRoot)) {
      for (const bucket of fs.readdirSync(storageRoot)) {
        const bucketDir = path.join(storageRoot, bucket);
        if (!fs.statSync(bucketDir).isDirectory()) continue;
        for (const name of fs.readdirSync(bucketDir)) {
          const buffer = fs.readFileSync(path.join(bucketDir, name));
          const ext = path.extname(name).toLowerCase();
          const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          const { error } = await supabase.storage.from(bucket).upload(name, buffer, { contentType, upsert: true });
          if (error) throw new Error(`Gagal memulihkan ${bucket}/${name}: ${error.message}`);
        }
      }
    }

    await client.query('BEGIN');
    transactionOpen = true;
    const update = await client.query('UPDATE app_state SET payload=$1::jsonb, revision=$2, updated_at=NOW() WHERE id=1', [JSON.stringify(backup.appState.payload), Number(backup.appState.revision || 1)]);
    if (update.rowCount !== 1) throw new Error('Baris app_state tidak tersedia. Jalankan supabase/setup.sql lebih dahulu.');
    await client.query('INSERT INTO audit_events (action, actor, detail, revision) VALUES ($1,$2,$3,$4)', ['RESTORE_SUPABASE_BACKUP', 'operator', `Backup ${path.basename(source)} dipulihkan.`, Number(backup.appState.revision || 1)]);
    await client.query('COMMIT');
    transactionOpen = false;
    console.log(`Pemulihan selesai dari: ${source}`);
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
