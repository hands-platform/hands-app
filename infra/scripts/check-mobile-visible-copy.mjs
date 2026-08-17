import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dartFiles = [
  ...listFiles('apps/customer_app/lib', '.dart'),
  ...listFiles('apps/provider_app/lib', '.dart'),
].sort();

const textFiles = ['apps/customer_app/README.md', 'apps/provider_app/README.md'];

const providerAppBannedVisibleCopy = [
  'Booking requests',
  'Demo partner login',
  'Open active chats',
  'Complete service',
  'Accept request',
  'Go online',
  'Go offline',
  'Request withdrawal',
];

const bannedPatterns = [
  { label: 'non-English Hangul visible copy', pattern: /[\u3131-\u318e\uac00-\ud7a3]/u },
  { label: 'legacy backup wording', pattern: /\bbackup\b/i },
  { label: 'tip wording', pattern: /\b(tips?|gratuity)\b/i },
  { label: 'VIP wording', pattern: /\bVIP\b/i },
  { label: 'people scoring wording', pattern: /\b(scoring|score)\b/i },
  { label: 'legacy low-rating wording', pattern: /\bLow[- ]rating\b/i },
  {
    label: 'judgmental account wording',
    pattern: /\b(account misuse|fraud|misuse|abuse controls|suspicious|trusted partner)\b/i,
  },
  {
    label: 'partner hierarchy wording',
    pattern:
      /\b(trusted|trust review|trusted badge|trust badge|partner badge|profile badge|promoted into)\b/i,
  },
  {
    label: 'legacy provider display wording',
    pattern: /\bproviders?\b/i,
  },
];
const ignoredTechnicalLiterals = new Set([
  'PROVIDER',
  'provider',
  'suspicious',
  'suspiciousReason',
  'QR banking provider / VietQR',
]);

const violations = [];

for (const file of dartFiles) {
  const source = readFileSync(file, 'utf8');
  const normalizedFile = normalizePath(file);
  const koreanLocaleRanges = normalizedFile.startsWith('apps/customer_app/lib')
    ? findDartLocaleMapRanges(source, 'ko')
    : [];
  for (const literal of extractDartStringLiterals(source)) {
    recordViolations(file, literal.value, literal.line, {
      allowHangul: koreanLocaleRanges.some(
        (range) => literal.index >= range.start && literal.index < range.end,
      ),
    });
  }
}

for (const file of textFiles) {
  const source = readFileSync(file, 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    recordViolations(file, line, index + 1);
  });
}

console.log(
  JSON.stringify(
    {
      ok: violations.length === 0,
      checked: {
        dartStringFiles: dartFiles.length,
        textFiles: textFiles.length,
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

function recordViolations(file, value, line, { allowHangul = false } = {}) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return;
  }
  if (ignoredTechnicalLiterals.has(normalized) || isTechnicalLiteral(normalized)) {
    return;
  }
  if (normalizePath(file).startsWith('apps/provider_app/lib')) {
    for (const phrase of providerAppBannedVisibleCopy) {
      if (normalized.includes(phrase)) {
        violations.push({
          file,
          line,
          label: 'legacy English Partner UI copy',
          match: phrase,
          text: normalized.slice(0, 180),
        });
      }
    }
  }
  for (const rule of bannedPatterns) {
    if (allowHangul && rule.label === 'non-English Hangul visible copy') {
      continue;
    }
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
}

function extractDartStringLiterals(source) {
  const literals = [];
  const pattern = /r?("""[\s\S]*?"""|'''[\s\S]*?'''|"([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[0].startsWith('r') ? match[0].slice(1) : match[0];
    const quote = raw.startsWith('"""') || raw.startsWith("'''") ? raw.slice(0, 3) : raw[0];
    const value = raw.slice(quote.length, raw.length - quote.length);
    literals.push({
      value,
      line: lineNumberAt(source, match.index ?? 0),
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    });
  }
  return literals;
}

function findDartLocaleMapRanges(source, locale) {
  const masked = maskDartNonStructuralText(source);
  const ranges = [];
  const pattern = new RegExp(`(['"])${locale}\\1\\s*:\\s*\\{`, 'g');

  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    const brace = start + match[0].lastIndexOf('{');
    const end = matchingBraceEnd(masked, brace);
    if (end !== -1) {
      ranges.push({ start, end });
    }
  }

  return ranges;
}

function maskDartNonStructuralText(source) {
  const chars = source.split('');
  for (const literal of extractDartStringLiterals(source)) {
    maskRange(chars, source, literal.index, literal.end);
  }

  const stringsMasked = chars.join('');
  const commentPattern = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g;
  for (const match of stringsMasked.matchAll(commentPattern)) {
    const start = match.index ?? 0;
    maskRange(chars, source, start, start + match[0].length);
  }
  return chars.join('');
}

function maskRange(chars, source, start, end) {
  for (let index = start; index < end; index += 1) {
    if (source[index] !== '\n' && source[index] !== '\r') {
      chars[index] = ' ';
    }
  }
}

function matchingBraceEnd(source, openingBrace) {
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return -1;
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
  if (value.includes('${provider')) {
    return true;
  }
  if (value.includes('${') && !/\s/.test(value)) {
    return true;
  }
  if (value.includes('/') || value.includes('.') || value.includes('_')) {
    return true;
  }
  return /^[a-z0-9-]+$/.test(value);
}

function normalizePath(path) {
  return path.replaceAll('\\', '/');
}

function listFiles(dir, extension) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return listFiles(path, extension);
    }
    return path.endsWith(extension) ? [path] : [];
  });
}
