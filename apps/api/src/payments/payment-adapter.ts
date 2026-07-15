import { PaymentMethod, PaymentStatus } from '@prisma/client';

export type PaymentAuthorization = {
  method: PaymentMethod;
  status: PaymentStatus;
  providerRef: string | null;
  rawMeta?: Record<string, unknown>;
};

export type PaymentCallbackResult = {
  providerRef: string;
  status: PaymentStatus;
  rawMeta: Record<string, unknown>;
};

export type PaymentAdapterMode = 'INTERNAL' | 'PLACEHOLDER' | 'GATEWAY';

export type PaymentAuthorizationInput = {
  bookingId: string;
  amount: number;
  currency: string;
  paymentId?: string;
};

export type PaymentOperationInput = {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  providerRef: string | null;
  rawMeta?: unknown;
};

export type PaymentRefundInput = PaymentOperationInput & {
  refundId: string;
  gatewayTransactionId?: string;
  requestedBy?: string;
  refundMeta?: unknown;
};

export type PaymentOperationResult = {
  status: PaymentStatus;
  providerFinalized?: boolean;
  rawMeta?: Record<string, unknown>;
};

export interface PaymentAdapter {
  readonly method: PaymentMethod;
  readonly mode: PaymentAdapterMode;
  initialAuthorization(input: PaymentAuthorizationInput): PaymentAuthorization;
  authorize(input: PaymentAuthorizationInput): Promise<PaymentAuthorization>;
  parseCallback(payload: unknown): PaymentCallbackResult;
  checkStatus(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  capture(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  release(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  refund(input: PaymentRefundInput): Promise<PaymentOperationResult>;
  checkRefund(input: PaymentRefundInput): Promise<PaymentOperationResult>;
}
