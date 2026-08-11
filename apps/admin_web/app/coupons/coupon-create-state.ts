export type CouponCreateResultItem = {
  readonly code: string;
  readonly ok: boolean;
  readonly reason?: string;
};

export type CouponCreateActionState = {
  readonly createdCount: number;
  readonly failedCount: number;
  readonly message: string;
  readonly results: readonly CouponCreateResultItem[];
  readonly status: 'error' | 'idle' | 'success' | 'warning';
};

export const INITIAL_COUPON_CREATE_STATE: CouponCreateActionState = {
  createdCount: 0,
  failedCount: 0,
  message: '',
  results: [],
  status: 'idle',
};
