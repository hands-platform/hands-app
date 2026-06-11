import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadMergedEnv(envFile = '.env') {
  const envPath = resolve(envFile);
  const envFileExists = existsSync(envPath);
  const fileEnv = envFileExists ? parseEnv(readFileSync(envPath, 'utf8')) : {};

  return {
    env: { ...fileEnv, ...process.env },
    envFileExists,
    envPath,
  };
}

export function parseEnv(source) {
  const entries = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const index = line.indexOf('=');
    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    const value = line
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    entries[key] = value;
  }
  return entries;
}
