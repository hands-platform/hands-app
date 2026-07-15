import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { loadMergedEnv } from './lib/env-file.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const staticOnly = process.argv.includes('--static-only');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

const apps = [
  {
    name: 'customer',
    envKey: 'ANDROID_CUSTOMER_UPLOAD_KEYSTORE',
    androidDir: resolve(repoRoot, 'apps', 'customer_app', 'android'),
  },
  {
    name: 'partner',
    envKey: 'ANDROID_PROVIDER_UPLOAD_KEYSTORE',
    androidDir: resolve(repoRoot, 'apps', 'provider_app', 'android'),
  },
];

const results = apps.map((app) => checkApp(app));
const output = {
  ok: results.every((result) => result.ok),
  mode: staticOnly ? 'static' : 'runtime',
  envFile: envFileExists ? envPath : null,
  results,
};

console.log(JSON.stringify(output, null, 2));
if (!output.ok) process.exitCode = 1;

function checkApp(app) {
  const gradlePath = resolve(app.androidDir, 'app', 'build.gradle.kts');
  const keyPropertiesPath = resolve(app.androidDir, 'key.properties');
  const checks = [];

  const gradle = existsSync(gradlePath) ? readFileSync(gradlePath, 'utf8') : '';
  add(checks, 'Gradle file exists', Boolean(gradle), gradlePath);
  add(
    checks,
    'Release build fails without key.properties',
    gradle.includes('releaseBuildRequested && !hasReleaseKeystore') && gradle.includes('throw GradleException'),
    'Keep release builds fail-closed when signing credentials are missing.',
  );
  add(
    checks,
    'Release uses dedicated signing config',
    gradle.includes('create("release")') && gradle.includes('signingConfigs.getByName("release")'),
    'Release builds must use the app upload key, never the debug signing config.',
  );

  if (staticOnly) return summarize(app.name, checks);

  add(checks, 'key.properties exists', existsSync(keyPropertiesPath), keyPropertiesPath);
  if (!existsSync(keyPropertiesPath)) return summarize(app.name, checks);

  const properties = parseProperties(readFileSync(keyPropertiesPath, 'utf8'));
  for (const key of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) {
    add(checks, `${key} is configured`, Boolean(properties[key]), `Set ${key} in ${keyPropertiesPath}.`);
  }

  const configuredStore = properties.storeFile
    ? resolvePath(app.androidDir, properties.storeFile)
    : null;
  const environmentStore = env[app.envKey]?.trim()
    ? resolvePath(repoRoot, env[app.envKey].trim())
    : null;

  add(checks, `${app.envKey} is configured`, Boolean(environmentStore), `Set ${app.envKey} in the ignored env file.`);
  add(checks, 'Keystore file exists', Boolean(configuredStore && existsSync(configuredStore)), configuredStore ?? 'Missing storeFile.');
  add(
    checks,
    'Env and key.properties point to the same keystore',
    Boolean(configuredStore && environmentStore && normalize(configuredStore) === normalize(environmentStore)),
    'Align the ignored env path and android/key.properties storeFile.',
  );

  if (configuredStore && existsSync(configuredStore) && properties.storePassword && properties.keyAlias) {
    const verification = verifyAlias(configuredStore, properties.keyAlias, properties.storePassword);
    add(checks, 'Keystore alias and password are valid', verification.ok, verification.message);
  }

  return summarize(app.name, checks);
}

function verifyAlias(keystorePath, alias, storePassword) {
  const result = spawnSync(
    'keytool',
    [
      '-list',
      '-keystore',
      keystorePath,
      '-alias',
      alias,
      '-storepass:env',
      'HANDS_ANDROID_KEYSTORE_PASSWORD',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, HANDS_ANDROID_KEYSTORE_PASSWORD: storePassword },
      windowsHide: true,
    },
  );

  if (result.error) {
    return { ok: false, message: `keytool could not run: ${result.error.message}` };
  }
  return result.status === 0
    ? { ok: true, message: 'keytool verified the configured alias.' }
    : { ok: false, message: 'keytool rejected the configured keystore password or alias.' };
}

function parseProperties(source) {
  const properties = {};
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    properties[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return properties;
}

function resolvePath(base, value) {
  return resolve(isAbsolute(value) ? value : resolve(base, value));
}

function normalize(value) {
  return value.replaceAll('\\', '/').toLowerCase();
}

function add(checks, name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
}

function summarize(app, checks) {
  return { app, ok: checks.every((check) => check.status === 'PASS'), checks };
}
