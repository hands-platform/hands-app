type ServiceBookingTraceStateInput = {
  readonly earningReady: boolean;
  readonly paymentReady: boolean;
  readonly taxReady: boolean;
  readonly walletReady: boolean;
};

type ServiceBookingTraceState = {
  readonly traceStatus: string;
  readonly traceTone: 'pill-success' | 'pill-warn';
};

export function serviceBookingTraceState({
  earningReady,
  paymentReady,
  taxReady,
  walletReady,
}: ServiceBookingTraceStateInput): ServiceBookingTraceState {
  const missingParts = [
    paymentReady ? null : 'payment',
    earningReady ? null : 'earning',
    taxReady ? null : 'tax',
    walletReady ? null : 'wallet',
  ].filter((part): part is string => Boolean(part));

  return {
    traceStatus: missingParts.length ? `Missing ${missingParts.join('/')}` : 'Complete',
    traceTone: missingParts.length ? 'pill-warn' : 'pill-success',
  };
}
