'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../server/database');

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyIfExists(source, destination) {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
}

function collectFiles(root, relative = '') {
  const current = path.join(root, relative);
  if (!fs.existsSync(current)) return [];
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? collectFiles(root, child) : [child];
  });
}

function main() {
  db.initialize();
  const root = path.resolve(__dirname, '..');
  const destination = path.resolve(process.argv[2] || path.join(root, 'backups', `backup-${stamp()}`));
  const uploadDir = process.env.DAPUR_RINI_UPLOAD_DIR ? path.resolve(process.env.DAPUR_RINI_UPLOAD_DIR) : path.join(root, 'server', 'uploads');

  if (fs.existsSync(destination) && fs.readdirSync(destination).length) {
    throw new Error(`Folder backup tidak kosong: ${destination}`);
  }
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });

  copyIfExists(db.STATE_FILE, path.join(destination, 'state.json'));
  copyIfExists(db.AUDIT_FILE, path.join(destination, 'audit.log'));
  if (fs.existsSync(uploadDir)) fs.cpSync(uploadDir, path.join(destination, 'uploads'), { recursive: true });

  const files = collectFiles(destination).filter((item) => item !== 'manifest.json').sort();
  const manifest = {
    format: 'dapur-rini-backup-v1',
    createdAt: new Date().toISOString(),
    appVersion: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
    files: Object.fromEntries(files.map((relative) => [relative.replaceAll(path.sep, '/'), hashFile(path.join(destination, relative))]))
  };
  fs.writeFileSync(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(`Backup berhasil: ${destination}`);
}

try {
  main();
} catch (error) {
  console.error(`Backup gagal: ${error.message}`);
  process.exitCode = 1;
}
