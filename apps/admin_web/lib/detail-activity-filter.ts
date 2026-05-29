export type DetailActivityTypeOption = {
  value: string;
  label: string;
  types: readonly string[];
};

type SearchParams = Record<string, string | string[] | undefined>;

export function readDetailActivityType(
  params: SearchParams = {},
  options: readonly DetailActivityTypeOption[],
  paramName = 'type',
) {
  const candidate = firstParam(params[paramName]) ?? 'all';
  return options.some((option) => option.value === candidate) ? candidate : 'all';
}

export function isWithinDetailActivityType(
  recordType: string,
  selectedType: string,
  options: readonly DetailActivityTypeOption[],
) {
  const option = options.find((item) => item.value === selectedType);
  if (!option || option.value === 'all') return true;
  return option.types.includes(recordType);
}

export function detailActivityTypeLabel(selectedType: string, options: readonly DetailActivityTypeOption[]) {
  return options.find((option) => option.value === selectedType)?.label ?? 'All event types';
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}
