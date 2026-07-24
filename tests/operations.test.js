'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function run(script, args, env) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

test('backup dan recovery memvalidasi manifest serta memulihkan state', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dapur-rini-ops-'));
  const dataDir = path.join(temp, 'data');
  const uploadDir = path.join(temp, 'uploads');
  const backupDir = path.join(temp, 'backup');
  const env = { DAPUR_RINI_DATA_DIR: dataDir, DAPUR_RINI_UPLOAD_DIR: uploadDir };

  try {
    const backup = run('scripts/backup.js', [backupDir], env);
    assert.equal(backup.status, 0, backup.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.format, 'dapur-rini-backup-v1');
    assert.ok(manifest.files['state.json']);

    const original = JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8'));
    const changed = structuredClone(original);
    changed.settings.businessName = 'State yang harus diganti';
    fs.writeFileSync(path.join(dataDir, 'state.json'), `${JSON.stringify(changed, null, 2)}\n`);

    const recovery = run('scripts/recover.js', [backupDir], env);
    assert.equal(recovery.status, 0, recovery.stderr);
    const restored = JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8'));
    assert.equal(restored.settings.businessName, original.settings.businessName);
    assert.match(fs.readFileSync(path.join(dataDir, 'audit.log'), 'utf8'), /RECOVER_BACKUP/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
