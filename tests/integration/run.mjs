#!/usr/bin/env node
/**
 * Runs critical-path integration smoke tests.
 * Usage: npm run test:integration
 */
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDirs = [__dirname, path.join(__dirname, '..', 'unit')];

const files = (
  await Promise.all(
    testDirs.map(async (dir) => {
      try {
        const names = await readdir(dir);
        return names.filter((f) => f.endsWith('.test.js')).map((f) => path.join(dir, f));
      } catch {
        return [];
      }
    }),
  )
)
  .flat()
  .sort();

if (!files.length) {
  console.error('No integration test files found.');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 1));
