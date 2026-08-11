import { PrismaClient } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

if (
  env.NODE_ENV === 'production' &&
  env.ALLOW_PUBLIC_SITE_BOOTSTRAP !== 'true'
) {
  throw new Error(
    'Public site bootstrap is disabled in production. Set ALLOW_PUBLIC_SITE_BOOTSTRAP=true for an intentional run.',
  );
}

const prisma = new PrismaClient();
const locales = ['vi', 'ko', 'en', 'ja', 'zh'];

const structures = {
  MAIN: [
    ['/', ['HERO', 'APP_OVERVIEW', 'CTA']],
    ['/partners', ['HERO', 'PARTNER_DIRECTORY', 'CTA']],
    ['/partners/[city]', ['PARTNER_DIRECTORY', 'CTA']],
    ['/partners/[city]/[district]', ['PARTNER_DIRECTORY', 'CTA']],
    ['/partners/[city]/[district]/[slug]', ['PARTNER_DETAIL', 'CTA']],
    ['/news', ['APP_OVERVIEW']],
    ['/company', ['COMPANY_INFORMATION']],
    ['/service-areas', ['COMPANY_INFORMATION']],
    ['/contact', ['CONTACT']],
    ['/support/faq', ['FAQ']],
    ['/support/disputes', ['CONTACT']],
    ['/safety', ['APP_OVERVIEW']],
    ['/partner-policy', ['LEGAL_DOCUMENT']],
    ['/legal/partner-terms', ['LEGAL_DOCUMENT']],
    ['/legal/privacy', ['LEGAL_DOCUMENT']],
    ['/legal/cookies', ['LEGAL_DOCUMENT']],
    ['/legal/terms', ['LEGAL_DOCUMENT']],
    ['/legal/app', ['LEGAL_DOCUMENT']],
    ['/company-info', ['COMPANY_INFORMATION']],
  ],
  PARTNER_RECRUITMENT: [
    ['/', ['HERO', 'RECRUITMENT_BENEFITS', 'RECRUITMENT_PROCESS', 'FAQ', 'CTA']],
    ['/requirements', ['RECRUITMENT_BENEFITS', 'CTA']],
    ['/process', ['RECRUITMENT_PROCESS', 'FAQ', 'CTA']],
    ['/faq', ['FAQ', 'CTA']],
    ['/apply', ['CTA']],
    ['/company', ['COMPANY_INFORMATION']],
    ['/service-areas', ['COMPANY_INFORMATION']],
    ['/contact', ['CONTACT']],
    ['/safety', ['APP_OVERVIEW']],
    ['/support/disputes', ['CONTACT']],
    ['/partner-policy', ['LEGAL_DOCUMENT']],
    ['/legal/partner-terms', ['LEGAL_DOCUMENT']],
    ['/legal/privacy', ['LEGAL_DOCUMENT']],
    ['/legal/terms', ['LEGAL_DOCUMENT']],
    ['/company-info', ['COMPANY_INFORMATION']],
  ],
};

try {
  for (const [site, routes] of Object.entries(structures)) {
    for (const locale of locales) {
      for (const [path, sectionKinds] of routes) {
        const internalName = `${site} ${locale.toUpperCase()} ${path}`;
        await prisma.publicSitePage.upsert({
          where: { site_locale_path: { site, locale, path } },
          update: { internalName },
          create: {
            site,
            locale,
            path,
            internalName,
            status: 'DRAFT',
            noIndex: true,
            sections: {
              create: sectionKinds.map((kind, index) => ({
                key: `${kind.toLowerCase().replaceAll('_', '-')}-${index + 1}`,
                kind,
                sortOrder: index * 10,
              })),
            },
          },
        });
      }
    }
  }
  console.log('Public site route structure is ready.');
} finally {
  await prisma.$disconnect();
}
