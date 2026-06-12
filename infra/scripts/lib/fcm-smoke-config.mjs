export function envValue(env, key) {
  const value = String(env[key] ?? '').trim();
  return value ? value : undefined;
}

export function normalizeApiBaseUrl(value, fail) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    fail(`Unsupported API_BASE_URL=${value}. Use an absolute http(s) URL such as http://localhost:3000/api.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`Unsupported API_BASE_URL protocol=${url.protocol}. Use http or https.`);
  }

  return url.toString().replace(/\/$/, '');
}

export function normalizePlatform(value, fail) {
  const normalized = value.trim().toLowerCase();
  if (normalized !== 'android' && normalized !== 'ios') {
    fail(`Unsupported FCM_SMOKE_PLATFORM=${value}. Use android or ios.`);
  }
  return normalized;
}

export function positiveIntegerEnv(env, key, fallback, fail) {
  const rawValue = envValue(env, key);
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    fail(`Unsupported ${key}=${rawValue}. Use a positive integer in milliseconds.`);
  }

  return value;
}
