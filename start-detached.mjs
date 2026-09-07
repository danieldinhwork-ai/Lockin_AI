#!/usr/bin/env node
// Detach and run the LOCKIN.AI server
import { spawn } from 'child_process';
import { openSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logPath = '/Users/mcdinh/Documents/Documents/.freebuff/preview-8e0b4e71-75dd-455d-9509-ba05a1b9fb24.log';

const logFd = openSync(logPath, 'w');
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: __dirname,
  detached: true,
  stdio: ['ignore', logFd, logFd],
  env: { ...process.env, PATH: join(__dirname, '.tools', 'node-v22.23.2-darwin-arm64', 'bin') + ':' + process.env.PATH }
});
child.unref();
console.log('Server detached, pid=' + child.pid);
