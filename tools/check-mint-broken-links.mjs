#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { fileURLToPath } from 'node:url';

// Check the CLI's report as well as its exit status. A captured shell command
// must never turn a printed broken-link report into a successful CI check.
export function linkCheckFailure(result, output) {
  if (result.error) return `Cannot run Mintlify link checker: ${result.error.message}`;
  if (result.signal) return `Mintlify link checker stopped with signal ${result.signal}.`;
  const report = stripVTControlCharacters(output);
  if (/\bfound\s+[1-9]\d*\s+broken links?\b/i.test(report)) {
    return 'Mintlify reported broken links.';
  }
  if (result.status !== 0) return `Mintlify link checker exited with status ${result.status}.`;
  if (!/\bno broken links found\b/i.test(report)) {
    return 'Mintlify did not report a recognized successful link check.';
  }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = spawnSync('mint', ['broken-links', '--check-anchors', '--check-redirects'], {
    cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
    env: { ...process.env, CI: 'true', NO_COLOR: '1' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  const failure = linkCheckFailure(result, output);
  if (failure) {
    console.error(failure);
    process.exitCode = 1;
  }
}
