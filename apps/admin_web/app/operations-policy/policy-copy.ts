export function policyCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function policyValueLabel(
  value: number | string,
  singular: string,
  plural = `${singular}s`,
) {
  return `${value} ${Number(value) === 1 ? singular : plural}`;
}
