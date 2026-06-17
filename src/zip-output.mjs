#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export function runZip({ dir }) {
  if (!dir) throw new Error('Usage: siteshot zip --dir audit/eventflow');
  const out = `${dir.replace(/[\/\\]$/, '')}.zip`;
  const isWin = process.platform === 'win32';
  const result = isWin
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path "${dir}\\*" -DestinationPath "${out}" -Force`], { stdio: 'inherit' })
    : spawnSync('zip', ['-r', out, path.basename(dir)], { cwd: path.dirname(path.resolve(dir)), stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Zip failed. Compress the folder manually.');
  console.log(`Created ${out}`);
}
