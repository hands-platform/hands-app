const COUPON_RETURN_KEYS = ['couponPage', 'q', 'sort', 'view'] as const;

export function couponReturnTo(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const key of COUPON_RETURN_KEYS) {
    const value = readSingleParam(params[key]);
    if (value) query.set(key, value);
  }
  return query.size ? `/coupons?${query.toString()}` : '/coupons';
}

export function sanitizeCouponReturnTo(value?: string | null) {
  if (!value) return '/coupons';

  let parsed: URL;
  try {
    parsed = new URL(value, 'https://admin.hands.vn');
  } catch {
    return '/coupons';
  }
  if (parsed.origin !== 'https://admin.hands.vn' || parsed.pathname !== '/coupons') return '/coupons';

  const query = new URLSearchParams();
  for (const key of COUPON_RETURN_KEYS) {
    const value = parsed.searchParams.get(key)?.trim();
    if (!value) continue;
    if (key === 'couponPage' && (!/^\d+$/.test(value) || Number(value) < 2)) continue;
    if (key === 'q') query.set(key, value.slice(0, 80));
    else if (key === 'sort' && ['code', 'ending-soon'].includes(value)) query.set(key, value);
    else if (key === 'view' && ['all', 'expired', 'live', 'paused', 'records', 'scheduled'].includes(value)) query.set(key, value);
    else if (key === 'couponPage') query.set(key, value);
  }

  return query.size ? `/coupons?${query.toString()}` : '/coupons';
}

export function couponReturnWithNotice(returnTo: string | null | undefined, notice: string) {
  const safeReturnTo = sanitizeCouponReturnTo(returnTo);
  const parsed = new URL(safeReturnTo, 'https://admin.hands.vn');
  parsed.searchParams.set('couponNotice', notice);
  return `${parsed.pathname}?${parsed.searchParams.toString()}`;
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
