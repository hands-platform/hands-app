import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { percentile } from './admin-api-read-budget.mjs';

const EVENT_NAME = 'booking_settlement_gap_dry_run_fanout';
const EXPECTED_CANDIDATE_QUERY_COUNT = 2;
const MINIMUM_P95_SAMPLES = 20;
const P95_BUDGET_MS = 1_000;

export function parseSettlementDryRunFanoutEvents(source) {
  return String(source ?? '')
    .split(/\r?\n/)
    .map(parseSettlementDryRunFanoutLine)
    .filter(Boolean);
}

export function parseSettlementDryRunFanoutLine(line) {
  const value = parseLogJson(line);
  const candidate =
    value && typeof value === 'object' && typeof value.message === 'string'
      ? parseLogJson(value.message)
      : value;
  if (!candidate || typeof candidate !== 'object' || candidate.event !== EVENT_NAME) return null;
  const status = candidate.status ?? 'ok';
  if (!['ok', 'failed'].includes(status)) return null;
  if (!nonNegativeInteger(candidate.evaluated) || !finiteDuration(candidate.durationMs)) return null;

  return {
    event: EVENT_NAME,
    status,
    track: typeof candidate.track === 'string' ? candidate.track : 'historical-ready',
    evaluated: candidate.evaluated,
    durationMs: candidate.durationMs,
    candidateLoadMs: finiteDuration(candidate.candidateLoadMs) ? candidate.candidateLoadMs : null,
    candidateQueryCount: nonNegativeInteger(candidate.candidateQueryCount)
      ? candidate.candidateQueryCount
      : null,
    previewMs: finiteDuration(candidate.previewMs) ? candidate.previewMs : null,
    previewCallCount: nonNegativeInteger(candidate.previewCallCount)
      ? candidate.previewCallCount
      : null,
    totalMatched: nonNegativeInteger(candidate.totalMatched) ? candidate.totalMatched : null,
    truncated: candidate.truncated === true,
    failureStage: typeof candidate.failureStage === 'string' ? candidate.failureStage : null,
    observedAt: validInstant(candidate.observedAt) ? candidate.observedAt : null,
  };
}

export function buildSettlementDryRunFanoutReport(events) {
  const scopes = new Map();
  for (const event of events) {
    const bucket = evaluatedBucket(event.evaluated);
    const key = `${event.track}\u0000${bucket}`;
    const current = scopes.get(key) ?? [];
    current.push(event);
    scopes.set(key, current);
  }

  return {
    event: EVENT_NAME,
    expectedCandidateQueryCount: EXPECTED_CANDIDATE_QUERY_COUNT,
    minimumP95Samples: MINIMUM_P95_SAMPLES,
    p95BudgetMs: P95_BUDGET_MS,
    totalEventCount: events.length,
    scopes: [...scopes.entries()]
      .map(([key, scopedEvents]) => summarizeScope(key, scopedEvents))
      .sort((left, right) =>
        left.track.localeCompare(right.track) || bucketOrder(left.evaluatedBucket) - bucketOrder(right.evaluatedBucket),
      ),
  };
}

function summarizeScope(key, events) {
  const [track, bucket] = key.split('\u0000');
  const successful = events.filter((event) => event.status === 'ok');
  const failed = events.filter((event) => event.status === 'failed');
  const queryCounts = uniqueNumbers(events.map((event) => event.candidateQueryCount));
  const queryRegression = queryCounts.some((count) => count !== EXPECTED_CANDIDATE_QUERY_COUNT);
  const duration = summarizeDurations(successful.map((event) => event.durationMs));
  const truncatedCount = events.filter((event) => event.truncated).length;

  return {
    track,
    evaluatedBucket: bucket,
    sampleCount: events.length,
    successCount: successful.length,
    failedCount: failed.length,
    errorRate: rate(failed.length, events.length),
    truncatedCount,
    truncationRate: rate(truncatedCount, events.length),
    candidateQueryCounts: queryCounts,
    failureStages: countBy(failed.map((event) => event.failureStage ?? 'unknown')),
    decision:
      failed.length > 0
        ? 'INVESTIGATE_FAILURES'
        : queryRegression
          ? 'INVESTIGATE_QUERY_REGRESSION'
          : successful.length < MINIMUM_P95_SAMPLES
            ? 'INSUFFICIENT_SAMPLES'
            : duration.p95Ms > P95_BUDGET_MS
              ? 'REVIEW_BULK_API'
              : 'KEEP_CURRENT_FANOUT',
    durationMs: duration,
    candidateLoadMs: summarizeDurations(
      successful.map((event) => event.candidateLoadMs).filter(finiteDuration),
    ),
    previewMs: summarizeDurations(
      successful.map((event) => event.previewMs).filter(finiteDuration),
    ),
    previewCallCount: summarizeNumbers(
      successful.map((event) => event.previewCallCount).filter(nonNegativeInteger),
    ),
    totalMatched: summarizeNumbers(
      successful.map((event) => event.totalMatched).filter(nonNegativeInteger),
    ),
  };
}

function summarizeDurations(values) {
  return {
    samples: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    maxMs: values.length > 0 ? Math.max(...values) : 0,
  };
}

function summarizeNumbers(values) {
  return {
    samples: values.length,
    min: values.length > 0 ? Math.min(...values) : 0,
    max: values.length > 0 ? Math.max(...values) : 0,
  };
}

function evaluatedBucket(value) {
  if (value === 0) return '0';
  if (value <= 10) return '1-10';
  if (value <= 50) return '11-50';
  if (value <= 100) return '51-100';
  return '101+';
}

function bucketOrder(value) {
  return ['0', '1-10', '11-50', '51-100', '101+'].indexOf(value);
}

function parseLogJson(line) {
  const source = String(line ?? '').trim();
  const jsonStart = source.indexOf('{');
  if (jsonStart < 0) return null;
  try {
    return JSON.parse(source.slice(jsonStart));
  } catch {
    return null;
  }
}

function uniqueNumbers(values) {
  return [...new Set(values.filter(nonNegativeInteger))].sort((left, right) => left - right);
}

function countBy(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]),
  );
}

function rate(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

function finiteDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validInstant(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

const isDirectExecution = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;

if (isDirectExecution) {
  try {
    const source = readFileSync(process.argv[2] ?? 0, 'utf8');
    const events = parseSettlementDryRunFanoutEvents(source);
    if (events.length === 0) throw new Error(`No ${EVENT_NAME} events were found.`);
    console.log(JSON.stringify(buildSettlementDryRunFanoutReport(events), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
