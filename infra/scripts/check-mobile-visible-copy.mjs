import { readFileSync } from 'node:fs';

const dartFiles = [
  'apps/customer_app/lib/main.dart',
  'apps/customer_app/test/widget_test.dart',
  'apps/provider_app/lib/main.dart',
  'apps/provider_app/test/provider_wallet_gate_test.dart',
];

const textFiles = ['apps/customer_app/README.md', 'apps/provider_app/README.md'];

const bannedPatterns = [
  { label: 'legacy backup wording', pattern: /\bbackup\b/i },
  { label: 'tip wording', pattern: /\btips?\b/i },
  { label: 'VIP wording', pattern: /\bVIP\b/i },
  { label: 'people scoring wording', pattern: /\b(scoring|score)\b/i },
  { label: 'legacy low-rating wording', pattern: /\bLow[- ]rating\b/i },
];

const violations = [];

for (const file of dartFiles) {
  const source = readFileSync(file, 'utf8');
  for (const literal of extractDartStringLiterals(source)) {
    recordViolations(file, literal.value, literal.line);
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

function recordViolations(file, value, line) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
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
