import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outputPath = resolve(root, 'infra/supabase/.generated/hands-staging-setup.sql');

const sections = [
  {
    title: '01 core app schema',
    source: 'infra/supabase/hands-core-schema.sql',
    requiredPatterns: [
      /create extension if not exists postgis/i,
      /create table if not exists public\.profiles/i,
      /create table if not exists public\.bookings/i,
      /create or replace function public\.nearby_providers/i,
      /alter table public\.messages enable row level security/i,
      /create policy "messages participants insert"/i,
    ],
  },
  {
    title: '02 storage buckets and policies',
    source: 'infra/supabase/storage-schema.sql',
    requiredPatterns: [
      /insert into storage\.buckets/i,
      /hands-public/i,
      /hands-private/i,
      /create policy "private media owner read"/i,
    ],
  },
];

const failures = [];
const bundledSections = sections.map((section) => {
  const absoluteSource = resolve(root, section.source);
  const sql = readFileSync(absoluteSource, 'utf8').trim();

  for (const pattern of section.requiredPatterns) {
    if (!pattern.test(sql)) {
      failures.push(`${section.source} is missing required pattern ${pattern}`);
    }
  }

  return {
    ...section,
    sql,
  };
});

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

const generatedAt = new Date().toISOString();
const content = [
  '-- HANDS Supabase staging setup bundle',
  `-- Generated at ${generatedAt}`,
  '-- Source of truth remains the individual files under infra/supabase/.',
  '-- Apply this in a new Supabase staging project SQL Editor before turning on AUTH_BACKEND=supabase.',
  '--',
  '-- Order:',
  '-- 1. Core schema, tables, indexes, functions, RLS policies',
  '-- 2. Storage buckets and storage.objects policies',
  '--',
  '-- Notes:',
  '-- - Do not paste secrets into this SQL file.',
  '-- - infra/supabase/location-schema.sql is a standalone legacy draft; it is intentionally not included because',
  '--   provider_locations, customer_selected_locations, and nearby_providers are now covered by hands-core-schema.sql.',
  '-- - After applying this SQL, run npm.cmd run external:check:supabase for core Supabase readiness.',
  '-- - Run npm.cmd run supabase:location-exposure-smoke to confirm exact Partner locations and the nearby RPC are not anonymous.',
  '-- - Run npm.cmd run external:check:supabase-auth and npm.cmd run auth:supabase-smoke only when',
  '--   chosen SMS provider/Supabase Phone Auth E2E starts.',
  '',
  ...bundledSections.flatMap((section) => [
    '',
    '-- ============================================================================',
    `-- ${section.title.toUpperCase()}`,
    `-- Source: ${section.source}`,
    '-- ============================================================================',
    '',
    section.sql,
    '',
  ]),
].join('\n');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${content}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      output: normalize(relative(root, outputPath)),
      sections: bundledSections.map((section) => ({
        title: section.title,
        source: section.source,
        bytes: Buffer.byteLength(section.sql, 'utf8'),
      })),
      excluded: [
        {
          source: 'infra/supabase/location-schema.sql',
          reason: 'Standalone draft superseded by hands-core-schema.sql for current migration path.',
        },
      ],
      nextSteps: [
        'Open the generated SQL file and paste it into Supabase SQL Editor for the HANDS staging project.',
        'Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, and SUPABASE_SERVICE_ROLE_KEY in the API environment.',
        'Run npm.cmd run external:check:supabase.',
        'Run npm.cmd run supabase:location-exposure-smoke and require both anonymous requests to be denied.',
        'Run npm.cmd run external:check:supabase-auth and npm.cmd run auth:supabase-smoke only when the chosen SMS provider/Supabase Phone Auth E2E starts.',
      ],
    },
    null,
    2,
  ),
);

function normalize(value) {
  return value.replaceAll('\\', '/');
}
