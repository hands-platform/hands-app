import 'reflect-metadata';
import { ParseEnumPipe, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { PaymentMethod, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentsController } from './payments.controller';
import type { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  const payments = {
    capture: vi.fn(),
    customerCheckoutMethods: vi.fn(),
    handleCallback: vi.fn(),
    handleVnpayIpn: vi.fn(),
    refund: vi.fn(),
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
    payments.refund.mockResolvedValue({ id: 'payment-1' });

    await expect(controller.refund(admin, 'payment-1', { approvalAdminId: 'finance-admin-2' })).resolves.toEqual({
      id: 'payment-1',
    });

    expect(routeMetadata('refund')).toEqual({
      method: RequestMethod.POST,
      path: 'admin/payments/:id/refund',
    });
    expect(guardNames('refund')).toEqual([JwtAuthGuard.name, RolesGuard.name]);
    expect(rolesMetadata('refund')).toEqual([Role.ADMIN]);
    expect(payments.refund).toHaveBeenCalledWith('admin-1', 'payment-1', {
      approvalAdminId: 'finance-admin-2',
    });
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
