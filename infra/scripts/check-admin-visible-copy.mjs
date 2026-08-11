import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [
  ...listFiles('apps/admin_web/app', ['.ts', '.tsx']),
  ...listFiles('apps/admin_web/lib', ['.ts', '.tsx']),
].sort();

const nonVietnamCity = String.fromCharCode(66, 97, 110, 103, 107, 111, 107);
const nonVietnamCountry = String.fromCharCode(84, 104, 97, 105, 108, 97, 110, 100);
const nonVietnamTimezone = `Asia/${nonVietnamCity}`;
const nonVietnamCurrencyCode = String.fromCharCode(84, 72, 66);
const nonVietnamCurrencyName = `${String.fromCharCode(84, 104, 97, 105)} Baht`;

const bannedPatterns = [
  { label: 'non-English Hangul visible copy', pattern: /[\u3131-\u318e\uac00-\ud7a3]/u },
  {
    label: 'non-Vietnam region default',
    pattern: new RegExp(
      `\\b(${nonVietnamCity}|${nonVietnamCountry}|${nonVietnamTimezone}|${nonVietnamCurrencyCode}|${nonVietnamCurrencyName})\\b`,
      'i',
    ),
  },
  { label: 'tip wording', pattern: /\b(tips?|gratuity)\b/i },
  { label: 'legacy therapist wording', pattern: /\btherapists?\b/i },
  { label: 'ambiguous marketplace wording', pattern: /\bmarketplace demand\b/i },
  { label: 'VIP wording', pattern: /\bVIP\b/i },
  { label: 'people scoring wording', pattern: /\b(scoring|score)\b/i },
  { label: 'partner hierarchy wording', pattern: /\b(trusted badge|trust badge|partner badge|profile badge)\b/i },
  { label: 'negative wallet exception wording', pattern: /\bRecovery supervision\b/i },
  { label: 'negative wallet recovery workflow wording', pattern: /\bWallet recovery workflow\b/i },
  { label: 'ambiguous recovery follow-up wording', pattern: /\brecovery follow-up\b/i },
  { label: 'ambiguous recovery queue wording', pattern: /\bRecovery queue\b/i },
  {
    label: 'negative wallet broad acceptance wording',
    pattern: /\b(cash[- ]fee debt|negative wallet|wallet debt)\b[\s\S]{0,140}\b(booking\s+acceptance|future\s+partner\s+acceptance|partner\s+acceptance)\b/i,
  },
  { label: 'auto final assignment wording', pattern: /\bAuto-lock\b/i },
  {
    label: 'disabled customer final selection wording',
    pattern: /\bCustomer final selection is disabled\b/i,
  },
];

const coreOperatorCopyPatterns = [
  { label: 'mechanical count wording', pattern: /\((?:s|es)\)/g },
  { label: 'ambiguous loaded range wording', pattern: /\bAll loaded\b/g },
  { label: 'generic queue action wording', pattern: /\bOpen queue\b/g },
  { label: 'ambiguous live control wording', pattern: /\bPause live\b/g },
  { label: 'internal backlog disclaimer', pattern: /without mixing in older backlog/g },
];

const ignoredTechnicalLiterals = new Set([
  'provider',
  'Provider',
  'PROVIDER',
  'delivery.provider',
  'provider.payout_setup_required',
]);

const allowedServiceProviderCopy = /\b(?:auth|email|external|geocoding|identity|map|notification|oauth|payment|push|sms|storage) providers?\b/i;

const violations = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  recordSourceViolations(file, source);
  if (isCoreOperatorCopyFile(file) && !file.includes('.spec.') && !file.includes('.test.')) {
    recordCoreOperatorCopyViolations(file, source);
  }
  for (const literal of extractStringLiterals(source)) {
    recordViolations(file, literal.value, literal.line);
  }
}

console.log(
  JSON.stringify(
    {
      ok: violations.length === 0,
      purpose:
        'Static Admin visible-copy guard: keep active Operations UI English, Vietnam-scoped, Partner-led, and free of removed MVP flows.',
      checked: {
        files: files.length,
      },
      violations,
    },
    null,
    2,
  ),
);

if (violations.length > 0) {
  process.exitCode = 1;
}

function recordSourceViolations(file, source) {
  for (const rule of bannedPatterns) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`);
    for (const match of source.matchAll(pattern)) {
      violations.push({
        file,
        line: lineNumberAt(source, match.index ?? 0),
        label: rule.label,
        match: match[0],
        text: source.slice(match.index ?? 0, (match.index ?? 0) + 180).replace(/\s+/g, ' '),
      });
    }
  }
}

function recordViolations(file, value, line) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || ignoredTechnicalLiterals.has(normalized)) {
    return;
  }
  for (const rule of bannedPatterns) {
    const match = normalized.match(rule.pattern);
    if (match) {
      violations.push({
        file,
        line,
        label: rule.label,
        match: match[0],
        text: normalized.slice(0, 180),
      });
    }
  }
  if (isTechnicalLiteral(normalized)) {
    return;
  }
  if (
    !file.includes('.spec.') &&
    !file.includes('.test.') &&
    /\bproviders?\b/i.test(normalized) &&
    !allowedServiceProviderCopy.test(normalized)
  ) {
    violations.push({
      file,
      line,
      label: 'legacy Partner role wording',
      match: normalized.match(/\bproviders?\b/i)?.[0] ?? 'Provider',
      text: normalized.slice(0, 180),
    });
  }
}

function recordCoreOperatorCopyViolations(file, source) {
  for (const rule of coreOperatorCopyPatterns) {
    for (const match of source.matchAll(rule.pattern)) {
      violations.push({
        file,
        line: lineNumberAt(source, match.index ?? 0),
        label: rule.label,
        match: match[0],
        text: source.slice(match.index ?? 0, (match.index ?? 0) + 180).replace(/\s+/g, ' '),
      });
    }
  }
}

function isCoreOperatorCopyFile(file) {
  const normalized = file.replaceAll('\\', '/');
  return (
    normalized === 'apps/admin_web/app/page.tsx' ||
    normalized.includes('/start-shift-') ||
    normalized.startsWith('apps/admin_web/app/finance-overview/') ||
    normalized.startsWith('apps/admin_web/app/operations-handoff/') ||
    normalized.startsWith('apps/admin_web/app/refunds/') ||
    (normalized.startsWith('apps/admin_web/app/bookings/') && !normalized.includes('/[id]/')) ||
    (normalized.startsWith('apps/admin_web/app/notifications/') && !normalized.includes('/push-send/')) ||
    (normalized.startsWith('apps/admin_web/app/customers/') && !normalized.includes('/[id]/')) ||
    normalized === 'apps/admin_web/app/customers/[id]/page.tsx' ||
    normalized.endsWith('/customers/[id]/customer-booking-operation-board.tsx') ||
    normalized.endsWith('/customers/[id]/customer-detail-overview-shell.tsx') ||
    (normalized.startsWith('apps/admin_web/app/partners/') &&
      !normalized.includes('/[id]/') &&
      !normalized.includes('/overview/'))
  );
}

function extractStringLiterals(source) {
  const literals = [];
  const pattern = /("""[\s\S]*?"""|'''[\s\S]*?'''|"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[0];
    const quote = raw.startsWith('"""') || raw.startsWith("'''") ? raw.slice(0, 3) : raw[0];
    const value = raw.slice(quote.length, raw.length - quote.length);
    literals.push({
      value,
      line: lineNumberAt(source, match.index ?? 0),
    });
  }
  return literals;
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function isTechnicalLiteral(value) {
  if (value.includes('${') || value.includes('/') || value.includes('_') || value.includes('.')) {
    return true;
  }
  if (/^[a-z0-9:-]+$/i.test(value) && !value.includes(' ')) {
    return true;
  }
  if (value.split(/\s+/).every((token) => /^[a-z][a-z0-9-]*$/.test(token) && token.includes('-'))) {
    return true;
  }
  return false;
}

function listFiles(dir, extensions) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return listFiles(path, extensions);
    }
    return extensions.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}
