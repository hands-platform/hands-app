export type ParsedPayoutRuleInput = {
  customerPrice: number | null;
  providerPayoutAmount: number | null;
};

export function parseServiceInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const number = Number(raw);
  return Number.isInteger(number) ? number : null;
}

export function isValidServicePriceStep(price: number, priceStep: number) {
  return price > 0 && priceStep >= 100000 && price % priceStep === 0;
}

export function isValidServicePayout(providerPayoutAmount: number | null, customerPrice: number) {
  return providerPayoutAmount === null || (providerPayoutAmount >= 0 && providerPayoutAmount <= customerPrice);
}

export function parseBulkPayoutRules(rawRules: string): ParsedPayoutRuleInput[] {
  return rawRules
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [customerPriceRaw, providerPayoutRaw] = line.split(/[,\t]/).map((value) => value.trim());
      return {
        customerPrice: parseServiceInteger(customerPriceRaw),
        providerPayoutAmount: parseServiceInteger(providerPayoutRaw),
      };
    });
}

export function hasInvalidBulkPayoutRules(rules: ParsedPayoutRuleInput[]) {
  return (
    rules.length === 0 ||
    rules.some((rule) => !rule.customerPrice || rule.providerPayoutAmount === null) ||
    rules.some((rule) => (rule.providerPayoutAmount ?? 0) > (rule.customerPrice ?? 0))
  );
}
