import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const prismaSchema = readFileSync(resolve(root, 'apps/api/prisma/schema.prisma'), 'utf8');
const supabaseSchema = readFileSync(resolve(root, 'infra/supabase/hands-core-schema.sql'), 'utf8');

const enumChecks = [
  { prisma: 'BookingStatus', sql: 'booking_status' },
  { prisma: 'ProviderStatus', sql: 'provider_status' },
  { prisma: 'VerificationStatus', sql: 'verification_status' },
  { prisma: 'ParticipantStatus', sql: 'participant_status' },
  { prisma: 'PaymentStatus', sql: 'payment_status' },
  { prisma: 'PaymentMethod', sql: 'payment_method' },
  { prisma: 'ReviewStatus', sql: 'review_status' },
  { prisma: 'EarningStatus', sql: 'earning_status' },
  { prisma: 'PayoutBatchStatus', sql: 'payout_batch_status' },
  { prisma: 'FilePurpose', sql: 'file_purpose' },
  { prisma: 'FileUploadStatus', sql: 'file_upload_status' },
  { prisma: 'FileReviewStatus', sql: 'file_review_status' },
  { prisma: 'ProviderLevel', sql: 'provider_level' },
  { prisma: 'ProviderKycStatus', sql: 'provider_kyc_status' },
  { prisma: 'ProviderDocumentType', sql: 'provider_document_type' },
  { prisma: 'ProviderDocumentStatus', sql: 'provider_document_status' },
  { prisma: 'ProviderBankAccountStatus', sql: 'provider_bank_account_status' },
  { prisma: 'ProviderTaxProfileStatus', sql: 'provider_tax_profile_status' },
  { prisma: 'TaxPolicyStatus', sql: 'tax_policy_status' },
  { prisma: 'TaxRuleScope', sql: 'tax_rule_scope' },
  { prisma: 'ProviderAgreementType', sql: 'provider_agreement_type' },
];

const requiredTables = [
  'profiles',
  'providers',
  'provider_verifications',
  'provider_profiles',
  'provider_kyc',
  'provider_documents',
  'provider_bank_accounts',
  'provider_tax_profiles',
  'services',
  'provider_services',
  'provider_locations',
  'customer_selected_locations',
  'bookings',
  'booking_address_snapshots',
  'booking_services',
  'booking_participants',
  'chat_rooms',
  'messages',
  'payments',
  'reviews',
  'provider_payout_batches',
  'provider_payouts',
  'provider_earnings',
  'tax_policy_versions',
  'tax_rules',
  'provider_tax_logs',
  'withholding_logs',
  'provider_agreements',
  'provider_verification_logs',
  'provider_sessions',
  'provider_devices',
  'notifications',
  'push_devices',
  'notification_deliveries',
  'files',
  'coupons',
  'refunds',
  'admin_audit_logs',
  'admin_settings',
];

const failures = [];

const forbiddenSchemaFragments = [
  { label: 'scheduled booking column', pattern: /\bscheduled_at\b/i },
  { label: 'tip amount column', pattern: /\btip_amount_vnd\b/i },
  { label: 'partner numeric rating column', pattern: /\brating\s+numeric\b/i },
  { label: 'feedback score column', pattern: /\brating\s+integer\b/i },
  {
    label: 'authenticated table write grant',
    pattern: /grant\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+table[\s\S]*?to\s+authenticated\s*;/i,
  },
  {
    label: 'anonymous exact provider location table grant',
    pattern: /grant\s+select\s+on\s+table[^;]*public\.provider_locations[^;]*to\s+anon\s*;/i,
  },
  {
    label: 'browser role nearby provider RPC execution grant',
    pattern: /grant\s+execute\s+on\s+function\s+public\.nearby_providers[^;]*to\s+(?:anon|authenticated|anon\s*,\s*authenticated)/i,
  },
  {
    label: 'time-only provider location read policy',
    pattern: /create\s+policy\s+"recent provider locations read"[\s\S]*?updated_at\s*>=\s*now\(\)\s*-\s*interval/i,
  },
];

rejectPatterns(forbiddenSchemaFragments, 'Supabase core schema still contains forbidden MVP field');

checkEnumParity(enumChecks);
checkRequiredTables(requiredTables);
requireSchemaFragments([
  {
    label: 'chat participant message insert RLS policy',
    pattern: /create\s+policy\s+"messages participants insert"/i,
  },
  {
    label: 'nearby_providers radius search function',
    pattern: /create\s+or\s+replace\s+function\s+public\.nearby_providers/i,
  },
  {
    label: 'push devices role column',
    pattern: /role\s+public\.user_role\s+not\s+null\s+default\s+'CUSTOMER'/i,
  },
  {
    label: 'push devices last_seen_at column',
    pattern: /last_seen_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i,
  },
  {
    label: 'push devices user role enabled index',
    pattern: /push_devices_user_role_enabled_idx/i,
  },
  {
    label: 'authenticated PostgREST write grant revoke',
    pattern: /revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon\s*,\s*authenticated/i,
  },
  {
    label: 'authenticated read-only table grant',
    pattern: /grant\s+select\s+on\s+table[\s\S]*?to\s+authenticated\s*;/i,
  },
  {
    label: 'provider location owner or admin read policy',
    pattern: /create\s+policy\s+"provider locations owner or admin read"[\s\S]*?p\.user_id\s*=\s*auth\.uid\(\)/i,
  },
  {
    label: 'browser role nearby provider RPC revoke',
    pattern: /revoke\s+execute\s+on\s+function\s+public\.nearby_providers[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated/i,
  },
  {
    label: 'server-only nearby provider RPC grant',
    pattern: /grant\s+execute\s+on\s+function\s+public\.nearby_providers[^;]*to\s+service_role\s*;/i,
  },
  {
    label: 'future Data API table grants default to private',
    pattern:
      /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public[\s\S]*?revoke\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+tables\s+from\s+anon\s*,\s*authenticated\s*,\s*service_role/i,
  },
  {
    label: 'future Data API function execution defaults to private',
    pattern:
      /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public[\s\S]*?revoke\s+execute\s+on\s+functions\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i,
  },
]);

const requiredFileSchemaFragments = [
  { label: 'files purpose enum column', pattern: /purpose\s+public\.file_purpose\s+not\s+null/i },
  {
    label: 'files upload status enum column',
    pattern: /upload_status\s+public\.file_upload_status\s+not\s+null/i,
  },
  {
    label: 'files review status enum column',
    pattern: /review_status\s+public\.file_review_status\s+not\s+null/i,
  },
  { label: 'files reviewed_at column', pattern: /reviewed_at\s+timestamptz/i },
  { label: 'files review_reason column', pattern: /review_reason\s+text/i },
  { label: 'files uploaded_at column', pattern: /uploaded_at\s+timestamptz/i },
  { label: 'files size_bytes column', pattern: /size_bytes\s+integer/i },
  { label: 'files owner purpose index', pattern: /files_owner_purpose_idx/i },
  { label: 'files visibility purpose index', pattern: /files_visibility_purpose_idx/i },
  { label: 'files review status purpose index', pattern: /files_review_status_purpose_idx/i },
];

requireSchemaFragments(requiredFileSchemaFragments);

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      enumChecks: enumChecks.length,
      requiredTables: requiredTables.length,
      rlsTables: requiredTables.length,
    },
    null,
    2,
  ),
);

function extractPrismaEnum(name) {
  const match = prismaSchema.match(new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  if (!match) {
    throw new Error(`Unable to find Prisma enum ${name}`);
  }
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@'))
    .map((line) => line.split(/\s+/)[0]);
}

function checkEnumParity(checks) {
  for (const check of checks) {
    const prismaValues = extractPrismaEnum(check.prisma);
    const sqlValues = extractSqlEnum(check.sql);
    const missing = prismaValues.filter((value) => !sqlValues.includes(value));
    if (missing.length > 0) {
      failures.push(`${check.sql} is missing Prisma ${check.prisma} values: ${missing.join(', ')}`);
    }
  }
}

function checkRequiredTables(tables) {
  for (const table of tables) {
    if (!hasPublicTable(table)) {
      failures.push(`Supabase core schema is missing table public.${table}`);
    }
    if (!hasPublicTableRls(table)) {
      failures.push(`Supabase core schema table public.${table} does not enable RLS.`);
    }
  }
}

function requireSchemaFragments(fragments) {
  for (const fragment of fragments) {
    if (!fragment.pattern.test(supabaseSchema)) {
      failures.push(`Supabase core schema is missing ${fragment.label}.`);
    }
  }
}

function rejectPatterns(fragments, messagePrefix) {
  for (const fragment of fragments) {
    if (fragment.pattern.test(supabaseSchema)) {
      failures.push(`${messagePrefix}: ${fragment.label}.`);
    }
  }
}

function hasPublicTable(table) {
  return new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${escapeRegExp(table)}\\b`, 'i').test(
    supabaseSchema,
  );
}

function hasPublicTableRls(table) {
  return new RegExp(
    `alter\\s+table\\s+public\\.${escapeRegExp(table)}\\s+enable\\s+row\\s+level\\s+security`,
    'i',
  ).test(supabaseSchema);
}

function extractSqlEnum(name) {
  const match = supabaseSchema.match(
    new RegExp(`create\\s+type\\s+public\\.${name}\\s+as\\s+enum\\s*\\(([\\s\\S]*?)\\)`, 'i'),
  );
  if (!match) {
    throw new Error(`Unable to find Supabase SQL enum ${name}`);
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
