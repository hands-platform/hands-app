import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { percentile } from './admin-api-read-budget.mjs';

const EVENT_NAME = 'finance_overview_summary_duration';
const MINIMUM_P95_SAMPLES = 20;

export function parseFinanceOverviewDurationEvents(source) {
  return String(source ?? '')
    .split(/\r?\n/)
    .map(parseFinanceOverviewDurationLine)
    .filter(Boolean);
}

export function parseFinanceOverviewDurationLine(line) {
  const value = parseLogJson(line);
  const candidate =
    value && typeof value === 'object' && typeof value.message === 'string'
      ? parseLogJson(value.message)
      : value;
  if (!candidate || typeof candidate !== 'object' || candidate.event !== EVENT_NAME) return null;
  if (!['ok', 'failed'].includes(candidate.status)) return null;
  if (typeof candidate.range !== 'string' || typeof candidate.period !== 'string') return null;
  if (!finiteDuration(candidate.durationMs) || !candidate.summaryDurationMs) return null;

  const summaryDurationMs = Object.fromEntries(
    Object.entries(candidate.summaryDurationMs).filter(([, duration]) => finiteDuration(duration)),
  );
  const paymentSummaryPhaseDurationMs = Object.fromEntries(
    Object.entries(candidate.paymentSummaryPhaseDurationMs ?? {}).filter(([, duration]) => finiteDuration(duration)),
  );
  return {
    event: EVENT_NAME,
    status: candidate.status,
    range: candidate.range,
    period: candidate.period,
    durationMs: candidate.durationMs,
    summaryDurationMs,
    ...(Object.keys(paymentSummaryPhaseDurationMs).length > 0 ? { paymentSummaryPhaseDurationMs } : {}),
  };
}

export function buildFinanceOverviewDurationReport(events) {
  const scopes = new Map();
  for (const event of events) {
    const key = `${event.range}\u0000${event.period}`;
    const current = scopes.get(key) ?? [];
    current.push(event);
    scopes.set(key, current);
  }

  return {
    event: EVENT_NAME,
    totalEventCount: events.length,
    minimumP95Samples: MINIMUM_P95_SAMPLES,
    scopes: [...scopes.values()]
      .map(summarizeScope)
      .sort((left, right) => left.range.localeCompare(right.range) || left.period.localeCompare(right.period)),
  };
}

function summarizeScope(events) {
  const successful = events.filter((event) => event.status === 'ok');
  const failedCount = events.length - successful.length;
  const summaryNames = new Set(successful.flatMap((event) => Object.keys(event.summaryDurationMs)));
  const paymentSummaryPhaseNames = new Set(
    successful.flatMap((event) => Object.keys(event.paymentSummaryPhaseDurationMs ?? {})),
  );
  return {
    range: events[0].range,
    period: events[0].period,
    sampleCount: events.length,
    successCount: successful.length,
    failedCount,
    decision:
      failedCount > 0
        ? 'INVESTIGATE_FAILURES'
        : successful.length < MINIMUM_P95_SAMPLES
          ? 'INSUFFICIENT_SAMPLES'
          : 'READY_FOR_PERFORMANCE_REVIEW',
    durationMs: summarizeDurations(successful.map((event) => event.durationMs)),
    summaries: [...summaryNames]
      .map((name) => ({
        name,
        ...summarizeDurations(
          successful
            .map((event) => event.summaryDurationMs[name])
            .filter((duration) => finiteDuration(duration)),
        ),
      }))
      .sort((left, right) => right.p95Ms - left.p95Ms || left.name.localeCompare(right.name)),
    paymentSummaryPhases: [...paymentSummaryPhaseNames]
      .map((name) => ({
        name,
        ...summarizeDurations(
          successful
            .map((event) => event.paymentSummaryPhaseDurationMs?.[name])
            .filter((duration) => finiteDuration(duration)),
        ),
      }))
      .sort((left, right) => right.p95Ms - left.p95Ms || left.name.localeCompare(right.name)),
  };
}

function summarizeDurations(values) {
  return {
    samples: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: values.length > 0 ? Math.max(...values) : 0,
  };
}

function parseLogJson(line) {
  const source = String(line ?? '').trim();
  if (!source) return null;
  const jsonStart = source.indexOf('{');
  if (jsonStart < 0) return null;
  try {
    return JSON.parse(source.slice(jsonStart));
  } catch {
    return null;
  }
}

function finiteDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

const isDirectExecution = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;

if (isDirectExecution) {
  try {
    const source = readFileSync(process.argv[2] ?? 0, 'utf8');
    const events = parseFinanceOverviewDurationEvents(source);
    if (events.length === 0) throw new Error(`No ${EVENT_NAME} events were found.`);
    console.log(JSON.stringify(buildFinanceOverviewDurationReport(events), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
