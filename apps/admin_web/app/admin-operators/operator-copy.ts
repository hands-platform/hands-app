export function formatOperatorCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function operatorHistoryActorLabel(
  actor: null | { readonly email: string | null; readonly fullName: string | null; readonly id: string },
) {
  return actor?.fullName ?? actor?.email ?? actor?.id ?? 'System';
}
