'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const domain = require('../server/domain');
const db = require('../server/database');

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function atomicCopy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = `${destination}.${process.pid}.${Date.now()}.tmp`;
  fs.copyFileSync(source, temp);
  fs.renameSync(temp, destination);
}

function main() {
  const source = process.argv[2] ? path.resolve(process.argv[2]) : '';
  if (!source) throw new Error('Berikan folder backup. Contoh: npm run recover -- backups/backup-2026-07-24T10-00-00-000Z');
  const manifestPath = path.join(source, 'manifest.json');
  const statePath = path.join(source, 'state.json');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(statePath)) throw new Error('Backup tidak lengkap. manifest.json dan state.json wajib tersedia.');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 'dapur-rini-backup-v1') throw new Error('Format backup tidak dikenal.');
  Object.entries(manifest.files || {}).forEach(([relative, expected]) => {
    const file = path.resolve(source, relative);
    if (!file.startsWith(source + path.sep) || !fs.existsSync(file)) throw new Error(`File backup hilang: ${relative}`);
    if (hashFile(file) !== expected) throw new Error(`Checksum tidak cocok: ${relative}`);
  });

  const candidate = domain.ensureCollections(JSON.parse(fs.readFileSync(statePath, 'utf8')));
  domain.assertInvariants(candidate);

  db.initialize();
  const safetyDir = path.join(path.dirname(db.DATA_DIR), `pre-recovery-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(safetyDir, { recursive: true, mode: 0o700 });
  if (fs.existsSync(db.STATE_FILE)) fs.copyFileSync(db.STATE_FILE, path.join(safetyDir, 'state.json'));
  if (fs.existsSync(db.AUDIT_FILE)) fs.copyFileSync(db.AUDIT_FILE, path.join(safetyDir, 'audit.log'));

  atomicCopy(statePath, db.STATE_FILE);
  const auditPath = path.join(source, 'audit.log');
  if (fs.existsSync(auditPath)) atomicCopy(auditPath, db.AUDIT_FILE);

  const root = path.resolve(__dirname, '..');
  const uploadDir = process.env.DAPUR_RINI_UPLOAD_DIR ? path.resolve(process.env.DAPUR_RINI_UPLOAD_DIR) : path.join(root, 'server', 'uploads');
  const backupUploads = path.join(source, 'uploads');
  if (fs.existsSync(backupUploads)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
    fs.cpSync(backupUploads, uploadDir, { recursive: true });
  }

  db.appendAudit({ action: 'RECOVER_BACKUP', actor: 'operator', detail: `Dipulihkan dari ${source}. Safety copy: ${safetyDir}.`, revision: candidate.stateRevision });
  console.log(`Pemulihan berhasil dari: ${source}`);
  console.log(`Salinan pengaman state sebelumnya: ${safetyDir}`);
}

try {
  main();
} catch (error) {
  console.error(`Pemulihan gagal: ${error.message}`);
  process.exitCode = 1;
}
