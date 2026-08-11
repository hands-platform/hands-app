export const COUPON_BATCH_LIMIT = 50;
export const COUPON_CODE_MAX_LENGTH = 80;

export type CouponCodeBatch = {
  readonly accepted: readonly string[];
  readonly duplicates: readonly string[];
  readonly invalid: readonly string[];
  readonly overLimit: readonly string[];
  readonly tooLong: readonly string[];
};

export function parseCouponCodeBatch(raw: string): CouponCodeBatch {
  const accepted: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  const tooLong: string[] = [];
  const seen = new Set<string>();

  for (const token of raw.split(/[\s,]+/)) {
    const code = token.trim().toUpperCase();
    if (!code) continue;
    if (seen.has(code)) {
      duplicates.push(code);
      continue;
    }
    seen.add(code);
    if (code.length > COUPON_CODE_MAX_LENGTH) {
      tooLong.push(code);
      continue;
    }
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
      invalid.push(code);
      continue;
    }
    accepted.push(code);
  }

  return {
    accepted: accepted.slice(0, COUPON_BATCH_LIMIT),
    duplicates,
    invalid,
    overLimit: accepted.slice(COUPON_BATCH_LIMIT),
    tooLong,
  };
}
