import { lookup } from 'node:dns/promises';
import { connect } from 'node:tls';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  buildProductionNetworkTargets,
  validateProductionHttpResult,
  validateProductionNetworkTarget,
} from './lib/production-network.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const dryRun = process.argv.includes('--dry-run');
const timeoutMs = readTimeout(process.argv.find((arg) => arg.startsWith('--timeout-ms='))?.split('=')[1]);
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const targets = buildProductionNetworkTargets(env);

const results = [];
for (const target of targets) {
  results.push(await inspectTarget(target));
}

const report = {
  ok: results.every((result) => result.status === 'PASS'),
  action: dryRun ? 'production-network-dry-run' : 'production-network-smoke',
  envFile: { exists: envFileExists, path: envPath },
  results,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  process.exitCode = 1;
}

async function inspectTarget(target) {
  if (target.envMissing) {
    return failure(target, 'Required production URL is not configured.');
  }

  let url;
  try {
    url = validateProductionNetworkTarget(target);
  } catch (error) {
    return failure(target, errorMessage(error));
  }

  if (dryRun) {
    return {
      name: target.name,
      origin: url.origin,
      path: url.pathname,
      status: 'PASS',
      verification: 'CONFIG_ONLY',
    };
  }

  try {
    const addresses = await withTimeout(
      lookup(url.hostname, { all: true, verbatim: true }),
      timeoutMs,
      `${target.name} DNS lookup timed out`,
    );
    if (!addresses.length) {
      throw new Error(`${target.name} DNS lookup returned no addresses.`);
    }
    const certificate = await inspectCertificate(url, timeoutMs);
    const response = await fetch(url, {
      headers: { 'user-agent': 'HANDS-production-network-smoke/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const http = validateProductionHttpResult(target, response);

    return {
      name: target.name,
      origin: url.origin,
      path: url.pathname,
      status: 'PASS',
      dnsAddressCount: addresses.length,
      certificateExpiresAt: certificate.expiresAt,
      httpStatus: http.status,
      finalOrigin: http.finalOrigin,
      verification: 'DNS_TLS_HTTPS',
    };
  } catch (error) {
    return failure(target, errorMessage(error), url);
  }
}

function inspectCertificate(url, timeout) {
  return new Promise((resolve, reject) => {
    const socket = connect({
      host: url.hostname,
      port: Number(url.port || 443),
      rejectUnauthorized: true,
      servername: url.hostname,
    });
    socket.setTimeout(timeout);
    socket.once('secureConnect', () => {
      const certificate = socket.getPeerCertificate();
      const expiresAt = certificate.valid_to ? new Date(certificate.valid_to) : null;
      socket.end();
      if (!socket.authorized) {
        reject(new Error(`TLS authorization failed: ${socket.authorizationError ?? 'unknown error'}`));
        return;
      }
      if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        reject(new Error('TLS certificate is expired or has no valid expiry date.'));
        return;
      }
      resolve({ expiresAt: expiresAt.toISOString() });
    });
    socket.once('timeout', () => socket.destroy(new Error('TLS connection timed out.')));
    socket.once('error', reject);
  });
}

function failure(target, error, url = null) {
  return {
    name: target.name,
    origin: url?.origin ?? null,
    path: url?.pathname ?? null,
    status: 'FAIL',
    error,
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function readTimeout(value) {
  const parsed = Number(value ?? 10000);
  return Number.isFinite(parsed) && parsed >= 1000 && parsed <= 60000 ? parsed : 10000;
}

function withTimeout(promise, timeout, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), timeout);
      timer.unref?.();
    }),
  ]);
}
