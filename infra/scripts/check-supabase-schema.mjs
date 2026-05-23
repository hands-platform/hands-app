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
];

const requiredTables = [
  'profiles',
  'providers',
  'provider_verifications',
  'services',
  'provider_services',
  'provider_locations',
  'customer_selected_locations',
  'bookings',
  'booking_services',
  'booking_participants',
  'chat_rooms',
  'messages',
  'payments',
  'reviews',
  'provider_payout_batches',
  'provider_earnings',
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

for (const check of enumChecks) {
  const prismaValues = extractPrismaEnum(check.prisma);
  const sqlValues = extractSqlEnum(check.sql);
  const missing = prismaValues.filter((value) => !sqlValues.includes(value));
  if (missing.length > 0) {
    failures.push(`${check.sql} is missing Prisma ${check.prisma} values: ${missing.join(', ')}`);
  }
}

for (const table of requiredTables) {
  if (
    !new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, 'i').test(supabaseSchema)
  ) {
    failures.push(`Supabase core schema is missing table public.${table}`);
  }
}

if (!/create\s+policy\s+"messages participants insert"/i.test(supabaseSchema)) {
  failures.push('Supabase core schema is missing chat participant message insert RLS policy.');
}

if (!/create\s+or\s+replace\s+function\s+public\.nearby_providers/i.test(supabaseSchema)) {
  failures.push('Supabase core schema is missing nearby_providers radius search function.');
}

const requiredFileSchemaFragments = [
  { label: 'files purpose enum column', pattern: /purpose\s+public\.file_purpose\s+not\s+null/i },
  {
    label: 'files upload status enum column',
    pattern: /upload_status\s+public\.file_upload_status\s+not\s+null/i,
  },
  { label: 'files uploaded_at column', pattern: /uploaded_at\s+timestamptz/i },
  { label: 'files size_bytes column', pattern: /size_bytes\s+integer/i },
  { label: 'files owner purpose index', pattern: /files_owner_purpose_idx/i },
  { label: 'files visibility purpose index', pattern: /files_visibility_purpose_idx/i },
];

for (const fragment of requiredFileSchemaFragments) {
  if (!fragment.pattern.test(supabaseSchema)) {
    failures.push(`Supabase core schema is missing ${fragment.label}.`);
  }
}

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

function extractSqlEnum(name) {
  const match = supabaseSchema.match(
    new RegExp(`create\\s+type\\s+public\\.${name}\\s+as\\s+enum\\s*\\(([\\s\\S]*?)\\)`, 'i'),
  );
  if (!match) {
    throw new Error(`Unable to find Supabase SQL enum ${name}`);
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
}
