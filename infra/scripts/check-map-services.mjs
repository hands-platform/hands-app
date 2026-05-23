import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const envPath = resolve(envFile);
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const env = { ...fileEnv, ...process.env };

const mapTilerApiKey = String(env.MAPTILER_API_KEY ?? '').trim();
const geoapifyApiKey = String(env.GEOAPIFY_API_KEY ?? '').trim();

const checks = [];

await addAsyncCheck('maptiler', 'streets-v2 style', async () => {
  if (!mapTilerApiKey) {
    return {
      status: 'FAIL',
      detail: 'MAPTILER_API_KEY is missing.',
      fix: 'Set MAPTILER_API_KEY in ignored .env or the shell.',
    };
  }

  const url = new URL('https://api.maptiler.com/maps/streets-v2/style.json');
  url.searchParams.set('key', mapTilerApiKey);
  const body = await fetchJson(url);
  if (body?.version && body?.sources) {
    return {
      status: 'PASS',
      detail: `style version=${body.version}`,
    };
  }

  return {
    status: 'FAIL',
    detail: 'MapTiler response did not include style metadata.',
    fix: 'Check that the key can access the streets-v2 style.',
  };
});

await addAsyncCheck('geoapify', 'Vietnam geocoding', async () => {
  if (!geoapifyApiKey) {
    return {
      status: 'FAIL',
      detail: 'GEOAPIFY_API_KEY is missing.',
      fix: 'Set GEOAPIFY_API_KEY in ignored .env or the shell.',
    };
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('text', 'Ho Chi Minh City, Vietnam');
  url.searchParams.set('filter', 'countrycode:vn');
  url.searchParams.set('bias', 'countrycode:vn');
  url.searchParams.set('limit', '1');
  url.searchParams.set('apiKey', geoapifyApiKey);
  const body = await fetchJson(url);
  const features = Array.isArray(body?.features) ? body.features : [];
  if (features.length > 0) {
    return {
      status: 'PASS',
      detail: `features=${features.length}`,
    };
  }

  return {
    status: 'FAIL',
    detail: 'Geoapify returned no Vietnam geocoding results.',
    fix: 'Check the Geoapify key, quota, and geocoding product access.',
  };
});

const failures = checks.filter((check) => check.status !== 'PASS');
const result = {
  ok: failures.length === 0,
  envFile: existsSync(envPath) ? envPath : null,
  checks,
  nextActions: failures.map((check) => check.fix).filter(Boolean),
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}

async function addAsyncCheck(category, name, run) {
  try {
    const result = await run();
    checks.push({
      category,
      name,
      status: result.status,
      detail: result.detail,
      fix: result.fix,
    });
  } catch (error) {
    checks.push({
      category,
      name,
      status: 'FAIL',
      detail: error instanceof Error ? error.message : String(error),
      fix: `Check ${category} credentials, network access, and account quota.`,
    });
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url.hostname}`);
  }

  return response.json();
}

function parseEnv(source) {
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
