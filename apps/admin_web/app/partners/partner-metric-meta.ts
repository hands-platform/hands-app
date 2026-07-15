export function partnerDirectoryMetricMeta(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('total')) {
    return { kind: 'record', scope: 'All records' } as const;
  }

  if (normalized.includes('approved')) {
    return { kind: 'record', scope: 'Approval records' } as const;
  }

  if (
    normalized.includes('blocked') ||
    normalized.includes('debt') ||
    normalized.includes('stale') ||
    normalized.includes('risk') ||
    normalized.includes('needs review') ||
    normalized.includes('device check') ||
    normalized.includes('open report')
  ) {
    return { kind: 'risk', scope: 'Needs action' } as const;
  }

  if (
    normalized.includes('verification') ||
    normalized.includes('kyc') ||
    normalized.includes('pending') ||
    normalized.includes('review') ||
    normalized.includes('profile')
  ) {
    return { kind: 'action', scope: 'Pending' } as const;
  }

  return { kind: 'live', scope: 'Live' } as const;
}

export function partnerFilterSummaryMetricMeta(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('filtered rows')) {
    return { kind: 'record', scope: 'Active filters' } as const;
  }

  if (
    normalized.includes('direct ready') ||
    normalized.includes('marketplace ready') ||
    normalized.includes('push reachable')
  ) {
    return { kind: 'live', scope: 'Live' } as const;
  }

  if (normalized.includes('approval')) {
    return { kind: 'action', scope: 'Pending' } as const;
  }

  if (normalized.includes('wallet') || normalized.includes('location')) {
    return { kind: 'risk', scope: 'Needs action' } as const;
  }

  return { kind: 'period', scope: 'Active filters' } as const;
}
