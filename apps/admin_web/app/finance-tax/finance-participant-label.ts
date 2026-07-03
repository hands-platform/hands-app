type FinancePerson = {
  readonly fullName?: string | null;
  readonly phone?: string | null;
};

export function financePersonName(user: FinancePerson | null | undefined, fallback: string) {
  return nonEmptyText(user?.fullName) ?? nonEmptyText(user?.phone) ?? fallback;
}

function nonEmptyText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}
