import 'reflect-metadata';
import { ParseEnumPipe, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { PaymentMethod, Role } from '@prisma/client';
import { AdminOperatorCategoryGuard } from '../admin/admin-operator-category.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentsController } from './payments.controller';
import type { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  const payments = {
    capture: vi.fn(),
    captureForAdmin: vi.fn(),
    customerCheckoutAction: vi.fn(),
    customerCheckoutMethods: vi.fn(),
    handleCallback: vi.fn(),
    handleVnpayIpn: vi.fn(),
    rejectRefund: vi.fn(),
    refund: vi.fn(),
    requestRefund: vi.fn(),
    requestRefundForAdmin: vi.fn(),
    releaseForAdmin: vi.fn(),
    syncStatusForAdmin: vi.fn(),
  };
  const controller = new PaymentsController(payments as unknown as PaymentsService);
  const admin = { id: 'admin-1', roles: [Role.ADMIN] } as AuthenticatedUser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps payment callback public but enum-constrains the provider method parameter', async () => {
    payments.handleCallback.mockResolvedValue({ ok: true });

    await expect(controller.callback(PaymentMethod.MOMO, { orderId: 'booking-1' })).resolves.toEqual({
      ok: true,
    });

    expect(routeMetadata('callback')).toEqual({
      method: RequestMethod.POST,
      path: 'payments/:method/callback',
    });
    expect(guardNames('callback')).toEqual([]);
    expect(rolesMetadata('callback')).toBeUndefined();
    expect(methodParamPipes('callback')).toEqual([expect.any(ParseEnumPipe)]);
    expect(payments.handleCallback).toHaveBeenCalledWith(PaymentMethod.MOMO, { orderId: 'booking-1' });
  });

  it('returns the customer checkout catalog behind the customer role guards', () => {
    payments.customerCheckoutMethods.mockReturnValue({
      currency: 'VND',
      defaultMethod: PaymentMethod.CASH,
      methods: [{ method: PaymentMethod.CASH, label: 'Cash', requiresRedirect: false }],
    });

    expect(controller.customerPaymentMethods()).toEqual({
      currency: 'VND',
      defaultMethod: PaymentMethod.CASH,
      methods: [{ method: PaymentMethod.CASH, label: 'Cash', requiresRedirect: false }],
    });
    expect(routeMetadata('customerPaymentMethods')).toEqual({
      method: RequestMethod.GET,
      path: 'customer/payment-methods',
    });
    expect(guardNames('customerPaymentMethods')).toEqual([JwtAuthGuard.name, RolesGuard.name]);
    expect(rolesMetadata('customerPaymentMethods')).toEqual([Role.CUSTOMER]);
  });

  it('returns only the signed-in customer booking payment action', async () => {
    payments.customerCheckoutAction.mockResolvedValue({
      bookingId: 'booking-1',
      checkoutUrl: 'https://payments.example.test/checkout',
      method: PaymentMethod.MOMO,
      paymentId: 'payment-1',
      status: 'PENDING',
    });
    const customer = { id: 'customer-user-1', roles: [Role.CUSTOMER] } as AuthenticatedUser;

    await expect(controller.customerPaymentAction(customer, 'booking-1')).resolves.toEqual(
      expect.objectContaining({ paymentId: 'payment-1' }),
    );
    expect(routeMetadata('customerPaymentAction')).toEqual({
      method: RequestMethod.GET,
      path: 'customer/bookings/:bookingId/payment-action',
    });
    expect(guardNames('customerPaymentAction')).toEqual([JwtAuthGuard.name, RolesGuard.name]);
    expect(rolesMetadata('customerPaymentAction')).toEqual([Role.CUSTOMER]);
    expect(payments.customerCheckoutAction).toHaveBeenCalledWith('customer-user-1', 'booking-1');
  });

  it('exposes the official VNPay GET IPN route without an application auth guard', async () => {
    const query = { vnp_TxnRef: 'booking-1', vnp_TransactionStatus: '00' };
    payments.handleVnpayIpn.mockResolvedValue({ RspCode: '00', Message: 'Confirm Success' });

    await expect(controller.vnpayIpn(query)).resolves.toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });
    expect(routeMetadata('vnpayIpn')).toEqual({
      method: RequestMethod.GET,
      path: 'payments/VNPAY/callback',
    });
    expect(guardNames('vnpayIpn')).toEqual([]);
    expect(payments.handleVnpayIpn).toHaveBeenCalledWith(query);
  });

  it('keeps admin payment commands role protected', async () => {
    payments.requestRefundForAdmin.mockResolvedValue({ id: 'payment-1', requested: true });
    payments.refund.mockResolvedValue({ id: 'payment-1' });
    payments.rejectRefund.mockResolvedValue({ id: 'refund-1', status: 'REJECTED' });

    const request = {
      idempotencyKey: 'payment-refund-request-1',
      reason: 'Customer evidence reviewed',
    };
    await expect(controller.requestRefund(admin, 'payment-1', request)).resolves.toEqual({
      id: 'payment-1',
      requested: true,
    });
    await expect(controller.refund(admin, 'payment-1')).resolves.toEqual({
      id: 'payment-1',
    });
    await expect(controller.rejectRefund(admin, 'refund-1', { reason: 'Evidence does not support refund' })).resolves.toEqual({
      id: 'refund-1',
      status: 'REJECTED',
    });

    expect(routeMetadata('requestRefund')).toEqual({
      method: RequestMethod.POST,
      path: 'admin/payments/:id/refund-request',
    });
    expect(routeMetadata('refund')).toEqual({
      method: RequestMethod.POST,
      path: 'admin/payments/:id/refund',
    });
    expect(routeMetadata('rejectRefund')).toEqual({
      method: RequestMethod.POST,
      path: 'admin/refunds/:id/reject',
    });
    expect(guardNames('requestRefund')).toEqual([
      JwtAuthGuard.name,
      RolesGuard.name,
      AdminOperatorCategoryGuard.name,
    ]);
    expect(guardNames('refund')).toEqual([
      JwtAuthGuard.name,
      RolesGuard.name,
      AdminOperatorCategoryGuard.name,
    ]);
    expect(guardNames('rejectRefund')).toEqual([
      JwtAuthGuard.name,
      RolesGuard.name,
      AdminOperatorCategoryGuard.name,
    ]);
    expect(rolesMetadata('requestRefund')).toEqual([Role.ADMIN]);
    expect(rolesMetadata('refund')).toEqual([Role.ADMIN]);
    expect(rolesMetadata('rejectRefund')).toEqual([Role.ADMIN]);
    expect(payments.requestRefundForAdmin).toHaveBeenCalledWith('admin-1', 'payment-1', request);
    expect(payments.refund).toHaveBeenCalledWith('admin-1', 'payment-1');
    expect(payments.rejectRefund).toHaveBeenCalledWith(
      'admin-1',
      'refund-1',
      'Evidence does not support refund',
    );
  });
});

function routeMetadata(methodName: keyof PaymentsController) {
  const handler = PaymentsController.prototype[methodName];

  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}

function rolesMetadata(methodName: keyof PaymentsController) {
  const handler = PaymentsController.prototype[methodName];

  return Reflect.getMetadata(ROLES_KEY, handler);
}

function guardNames(methodName: keyof PaymentsController) {
  const handler = PaymentsController.prototype[methodName];
  const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];

  return guards.map((guard: { name?: string }) => guard.name);
}

function methodParamPipes(methodName: keyof PaymentsController) {
  const metadata =
    (Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      PaymentsController,
      methodName,
    ) as Record<string, { data?: string; index: number; pipes?: unknown[] }> | undefined) ?? {};
  const methodParam = Object.values(metadata).find((entry) => entry.index === 0 && entry.data === 'method');

  return methodParam?.pipes ?? [];
}
