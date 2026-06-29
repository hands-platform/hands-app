export type TaxPolicyNotice = {
  readonly tone: 'success' | 'danger';
  readonly title: string;
  readonly detail: string;
  readonly badge: string;
};

export function taxPolicyNotice(params: Record<string, string | string[] | undefined>): TaxPolicyNotice | null {
  const notice = firstParam(params.taxPolicyNotice);
  const message = firstParam(params.message);

  if (notice === 'validation') {
    return {
      badge: 'Blocked',
      detail: message || 'Check the policy effective dates and try again.',
      title: 'Tax policy update blocked',
      tone: 'danger',
    };
  }

  return null;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
