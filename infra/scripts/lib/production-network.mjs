export const PRODUCTION_NETWORK_ENV_KEYS = ['PUBLIC_WEB_URL', 'API_PUBLIC_URL', 'ADMIN_PUBLIC_URL'];

export function buildProductionNetworkTargets(env) {
  return [
    target('public-web', env.PUBLIC_WEB_URL, '/'),
    target('api-readiness', env.API_PUBLIC_URL, '/api/health/ready'),
    target('admin-web', env.ADMIN_PUBLIC_URL, '/'),
  ];
}

export function validateProductionNetworkTarget(targetValue) {
  const url = new URL(targetValue.url);
  if (url.protocol !== 'https:') {
    throw new Error(`${targetValue.name} must use HTTPS.`);
  }
  if (url.username || url.password) {
    throw new Error(`${targetValue.name} must not include URL credentials.`);
  }
  return url;
}

export function validateProductionHttpResult(targetValue, response) {
  const finalUrl = new URL(response.url || targetValue.url);
  if (finalUrl.protocol !== 'https:') {
    throw new Error(`${targetValue.name} redirected to a non-HTTPS URL.`);
  }
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`${targetValue.name} returned HTTP ${response.status}.`);
  }
  return {
    finalOrigin: finalUrl.origin,
    status: response.status,
  };
}

function target(name, rawBaseUrl, path) {
  const baseUrl = String(rawBaseUrl ?? '').trim();
  if (!baseUrl) {
    return { name, envMissing: true, url: '' };
  }
  const url = new URL(baseUrl);
  url.pathname = path;
  url.search = '';
  url.hash = '';
  return { name, envMissing: false, url: url.toString() };
}
