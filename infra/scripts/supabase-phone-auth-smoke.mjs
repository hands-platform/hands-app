import { loadMergedEnv } from './lib/env-file.mjs';

const args = parseArgs(process.argv.slice(2));
const envFile = args.env ?? '.env';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

const supabaseUrl = normalizeSupabaseUrl(args['supabase-url'] ?? env.SUPABASE_URL);
const anonKey = stringValue(args['anon-key'] ?? env.SUPABASE_ANON_KEY);
const apiBaseUrl = normalizeApiBaseUrl(
  args['api-base-url'] ?? env.API_BASE_URL ?? 'http://localhost:3000/api',
);
const phone = stringValue(args.phone ?? env.SUPABASE_PHONE_SMOKE_PHONE);
const otp = stringValue(args.otp ?? env.SUPABASE_PHONE_SMOKE_OTP);
const role = normalizeRole(args.role ?? env.SUPABASE_PHONE_SMOKE_ROLE ?? 'CUSTOMER');
const shouldCreateUser = booleanValue(args['create-user'] ?? env.SUPABASE_PHONE_SMOKE_CREATE_USER, true);
const send = Boolean(args.send);
const verify = Boolean(args.verify);
const exchange = !args['no-exchange'];
const dryRun = Boolean(args['dry-run']) || (!send && !verify);

if (dryRun) {
  write({
    ok: true,
    mode: 'dry-run',
    contactsSupabaseAuth: false,
    contactsApi: false,
    envFile: {
      path: envPath,
      exists: envFileExists,
    },
    supabase: readinessSummary(),
    apiBaseUrl,
    role,
    phone: phone ? maskPhone(phone) : null,
    hasOtp: Boolean(otp),
    nextActions: dryRunNextActions(),
  });
  process.exit(0);
}

requireConfig('SUPABASE_URL', supabaseUrl);
requireConfig('SUPABASE_ANON_KEY', anonKey);
requireConfig('SUPABASE_PHONE_SMOKE_PHONE or --phone', phone);

const result = {
  ok: true,
  mode: send && verify ? 'send-and-verify' : send ? 'send' : 'verify',
  contactsSupabaseAuth: true,
  contactsApi: false,
  envFile: {
    path: envPath,
    exists: envFileExists,
  },
  supabase: readinessSummary(),
  apiBaseUrl,
  role,
  phone: maskPhone(phone),
  createUser: shouldCreateUser,
  otpSent: false,
  otpVerified: false,
  apiExchange: null,
  nextActions: [],
};

if (send) {
  await postSupabaseAuth('/otp', {
    phone,
    channel: 'sms',
    create_user: shouldCreateUser,
  });
  result.otpSent = true;
  result.nextActions.push(
    'Enter the received OTP with SUPABASE_PHONE_SMOKE_OTP, then run npm.cmd run auth:supabase-phone-smoke -- --verify.',
  );
}

if (verify) {
  requireConfig('SUPABASE_PHONE_SMOKE_OTP or --otp', otp);
  const verification = await postSupabaseAuth('/verify', {
    phone,
    token: otp,
    type: 'sms',
  });
  const supabaseAccessToken = accessTokenFromVerification(verification);
  if (!supabaseAccessToken) {
    fail('Supabase verified the OTP request but did not return an access token.');
  }

  result.otpVerified = true;
  result.supabaseUserId = verification.user?.id ?? verification.session?.user?.id ?? null;

  if (exchange) {
    const exchangeResult = await postApi('/auth/supabase/exchange', {
      supabaseAccessToken,
      role,
    });
    const accessToken = exchangeResult.accessToken;
    if (!accessToken) {
      fail('HANDS API exchange did not return an access token.');
    }

    const profileRoute = role === 'PROVIDER' ? '/provider/me' : '/customer/me';
    const profile = await getApi(profileRoute, accessToken);
    result.contactsApi = true;
    result.apiExchange = {
      ok: true,
      route: profileRoute,
      userId: profile.id ?? null,
      profileId: profile.customerProfile?.id ?? profile.providerProfile?.id ?? null,
    };
    result.nextActions.push(
      'Review the Supabase Auth user and HANDS linked user before switching mobile AUTH_BACKEND broadly.',
    );
  }
}

write(result);

function parseArgs(rawArgs) {
  const parsed = {};
  for (const arg of rawArgs) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const [key, ...valueParts] = arg.slice(2).split('=');
    parsed[key] = valueParts.length > 0 ? valueParts.join('=') : true;
  }
  return parsed;
}

function stringValue(value) {
  if (value === undefined || value === null || value === true || value === false) {
    return '';
  }
  return String(value).trim();
}

function booleanValue(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeRole(value) {
  const normalized = stringValue(value).toUpperCase();
  if (normalized !== 'CUSTOMER' && normalized !== 'PROVIDER') {
    fail(`Unsupported SUPABASE_PHONE_SMOKE_ROLE=${normalized || '<empty>'}. Use CUSTOMER or PROVIDER.`);
  }
  return normalized;
}

function normalizeSupabaseUrl(value) {
  const normalized = stringValue(value).replace(/\/+$/, '');
  if (!normalized) {
    return '';
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:') {
      fail('SUPABASE_URL must be an https URL.');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    fail('SUPABASE_URL must be a valid URL.');
  }
}

function normalizeApiBaseUrl(value) {
  const normalized = stringValue(value).replace(/\/+$/, '');
  if (!normalized) {
    fail('API_BASE_URL must not be empty.');
  }
  return normalized;
}

async function postSupabaseAuth(path, body) {
  return requestJson(`${supabaseUrl}/auth/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function postApi(path, body) {
  return requestJson(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getApi(path, accessToken) {
  return requestJson(`${apiBaseUrl}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text().catch(() => '');
  const body = parseJson(text);
  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${redactUrl(url)} failed: ${response.status} ${JSON.stringify(redact(body))}`,
    );
  }
  return body;
}

function parseJson(text) {
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

function accessTokenFromVerification(verification) {
  return verification.access_token ?? verification.session?.access_token ?? '';
}

function readinessSummary() {
  return {
    projectRef: projectRefFromUrl(supabaseUrl),
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(anonKey),
  };
}

function dryRunNextActions() {
  const actions = [];
  if (!supabaseUrl) {
    actions.push('Set SUPABASE_URL in the ignored env file.');
  }
  if (!anonKey) {
    actions.push('Set SUPABASE_ANON_KEY in the ignored env file.');
  }
  if (!phone) {
    actions.push('Set SUPABASE_PHONE_SMOKE_PHONE to the phone that should receive the OTP.');
  }
  actions.push('Run npm.cmd run auth:supabase-phone-smoke -- --send to send one live Supabase phone OTP.');
  actions.push(
    'After the OTP arrives, set SUPABASE_PHONE_SMOKE_OTP and run npm.cmd run auth:supabase-phone-smoke -- --verify.',
  );
  return actions;
}

function requireConfig(name, value) {
  if (!value) {
    fail(`${name} is required.`);
  }
}

function projectRefFromUrl(url) {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

function maskPhone(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length <= 4) {
    return '****';
  }
  return `${String(value).startsWith('+') ? '+' : ''}***${digits.slice(-4)}`;
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '<invalid-url>';
  }
}

function redact(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /token|secret|key|authorization|refresh/i.test(key) ? '<redacted>' : redact(entry),
    ]),
  );
}

function write(value) {
  console.log(JSON.stringify(value, null, 2));
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
