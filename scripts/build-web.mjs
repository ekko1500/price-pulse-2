// Build the static frontend for Firebase Hosting.
//
// The app is one codebase with two targets. For the static export we must hide
// the server-only API route handlers (Next's `output: 'export'` rejects route
// handlers), so we temporarily move `app/api` into node_modules (ignored by
// Next/tsconfig/eslint), build the export to `out/`, then restore it.
//
// Usage: npm run build:web

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'app', 'api');
const stashDir = path.join(root, 'node_modules', '.pp-api-stash');
const stashedApi = path.join(stashDir, 'api');
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

function restore() {
  if (fs.existsSync(stashedApi)) {
    fs.rmSync(apiDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(apiDir), { recursive: true });
    fs.renameSync(stashedApi, apiDir);
    fs.rmSync(stashDir, { recursive: true, force: true });
  }
}

let moved = false;
try {
  if (fs.existsSync(apiDir)) {
    fs.mkdirSync(stashDir, { recursive: true });
    fs.rmSync(stashedApi, { recursive: true, force: true });
    fs.renameSync(apiDir, stashedApi);
    moved = true;
  }

  const res = spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PRICEPULSE_TARGET: 'web' },
  });
  if (res.status !== 0) process.exitCode = res.status ?? 1;
  else console.log('\nStatic frontend written to ./out (deploy with: firebase deploy --only hosting)');
} finally {
  if (moved) restore();
}
