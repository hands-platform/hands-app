import { createHmac } from 'node:crypto';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);

const apiBaseUrl = env.API_BASE_URL ?? 'http://localhost:3000/api';
const jwtSecret = env.SUPABASE_JWT_SECRET;
const jwtAudience = env.SUPABASE_JWT_AUDIENCE ?? 'authenticated';
const smokeSubjects = {
  customer: 'smoke-supabase-auth-customer',
  provider: 'smoke-supabase-auth-provider',
  escalation: 'smoke-supabase-auth-role-escalation',
  userMetadataEscalation: 'smoke-supabase-auth-user-metadata-escalation',
  invalidAudience: 'smoke-supabase-auth-invalid-audience',
};

if (!jwtSecret) {
  throw new Error('SUPABASE_JWT_SECRET is required for the Supabase auth smoke test.');
}

const customerToken = signSupabaseToken({
  sub: smokeSubjects.customer,
  aud: jwtAudience,
  phone: '+84900009001',
  app_metadata: { role: 'CUSTOMER' },
  user_metadata: { role: 'CUSTOMER' },
});

const customer = await getJson('/customer/me', customerToken);

if (!customer?.id || !customer?.customerProfile) {
  throw new Error(`Supabase JWT did not map to a customer user: ${JSON.stringify(customer)}`);
}

const providerSupabaseToken = signSupabaseToken({
  sub: smokeSubjects.provider,
  aud: jwtAudience,
  phone: '+84800009002',
  app_metadata: { role: 'PROVIDER' },
  user_metadata: { role: 'PROVIDER' },
});
const providerExchange = await postJson('/auth/supabase/exchange', {
  supabaseAccessToken: providerSupabaseToken,
  role: 'PROVIDER',
});
const provider = await getJson('/provider/me', providerExchange.accessToken);
const directProvider = await getJson('/provider/me', providerSupabaseToken);

if (!provider?.id || !provider?.providerProfile || !directProvider?.providerProfile) {
  throw new Error(`Supabase exchange did not map to a provider user: ${JSON.stringify(provider)}`);
}

const escalationToken = signSupabaseToken({
  sub: smokeSubjects.escalation,
  aud: jwtAudience,
  phone: '+84700009003',
  app_metadata: { role: 'CUSTOMER' },
  user_metadata: { role: 'CUSTOMER' },
});
await postJson(
  '/auth/supabase/exchange',
  {
    supabaseAccessToken: escalationToken,
    role: 'PROVIDER',
  },
  401,
);

const userMetadataEscalationToken = signSupabaseToken({
  sub: smokeSubjects.userMetadataEscalation,
  aud: jwtAudience,
  phone: '+84500009004',
  app_metadata: { role: 'CUSTOMER' },
  user_metadata: { role: 'PROVIDER' },
});
await postJson(
  '/auth/supabase/exchange',
  {
    supabaseAccessToken: userMetadataEscalationToken,
    role: 'PROVIDER',
  },
  401,
);

const invalidAudienceToken = signSupabaseToken({
  sub: smokeSubjects.invalidAudience,
  aud: 'wrong-audience',
  phone: '+84600009005',
  app_metadata: { role: 'CUSTOMER' },
});
await getJson('/customer/me', invalidAudienceToken, 401);

console.log(
  JSON.stringify(
    {
      ok: true,
      authProvider: 'supabase',
      apiBaseUrl,
      customerUserId: customer.id,
      customerProfileId: customer.customerProfile.id,
      providerUserId: provider.id,
      providerProfileId: provider.providerProfile.id,
      directProviderRoute: true,
      roleEscalationDenied: true,
      userMetadataRoleEscalationDenied: true,
      invalidAudienceDenied: true,
    },
    null,
    2,
  ),
);

async function getJson(path, accessToken, expectedStatus = 200) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(`GET ${path} expected ${expectedStatus}: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function postJson(path, body, expectedStatus = [200, 201]) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => ({}));
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `POST ${path} expected ${expectedStatuses.join('/')} status: ${response.status} ${JSON.stringify(responseBody)}`,
    );
  }
  return responseBody;
}

function signSupabaseToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims = {
    iss: 'supabase',
    iat: now,
    exp: now + 600,
    ...payload,
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(claims));
  const signature = createHmac('sha256', jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}
