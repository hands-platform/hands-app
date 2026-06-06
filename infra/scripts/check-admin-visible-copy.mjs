import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [
  ...listFiles('apps/admin_web/app', ['.ts', '.tsx']),
  ...listFiles('apps/admin_web/lib', ['.ts', '.tsx']),
].sort();

const bannedPatterns = [
  { label: 'non-English Hangul visible copy', pattern: /[\u3131-\u318e\uac00-\ud7a3]/u },
  { label: 'non-Vietnam region default', pattern: /\b(Bangkok|Thailand|Asia\/Bangkok|THB|Thai Baht)\b/i },
  { label: 'tip wording', pattern: /\b(tips?|gratuity)\b/i },
  { label: 'legacy therapist wording', pattern: /\btherapists?\b/i },
  { label: 'VIP wording', pattern: /\bVIP\b/i },
  { label: 'people scoring wording', pattern: /\b(scoring|score)\b/i },
  { label: 'partner hierarchy wording', pattern: /\b(trusted badge|trust badge|partner badge|profile badge)\b/i },
  { label: 'negative wallet exception wording', pattern: /\bRecovery supervision\b/i },
  { label: 'auto final assignment wording', pattern: /\bAuto-lock\b/i },
  {
    label: 'disabled customer final selection wording',
    pattern: /\bCustomer final selection is disabled\b/i,
  },
];

const ignoredTechnicalLiterals = new Set([
  'provider',
  'Provider',
  'PROVIDER',
  'delivery.provider',
  'provider.payout_setup_required',
]);

const violations = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  recordSourceViolations(file, source);
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
