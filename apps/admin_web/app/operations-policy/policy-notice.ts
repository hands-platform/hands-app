export type OperationsPolicyNotice = {
  readonly tone: 'success' | 'danger';
  readonly title: string;
  readonly detail: string;
};

export function operationsPolicyNotice(
  params: Record<string, string | string[] | undefined>,
): OperationsPolicyNotice | null {
  const status = firstParam(params.status);
  const reason = firstParam(params.reason);
  if (status === 'saved') {
    return {
      tone: 'success',
      title: 'Operational policy saved',
      detail: `Updated ${reason}. New bookings and partner participation checks will use the latest enforced settings.`,
    };
  }
  if (status === 'blocked') {
    return {
      tone: 'danger',
      title: 'Policy update blocked',
      detail:
        reason === 'missing-value'
          ? 'Enter a policy value before saving.'
          : 'The API rejected this policy update. Check the allowed range and try again.',
    };
  }
  return null;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
