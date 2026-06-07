import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { BookingOpsTaskStatus, BookingOpsTaskType, PayoutBatchStatus } from '@prisma/client';
import { AdminController } from './admin.controller';

describe('admin request DTO validation', () => {
  function bodyMetatype(methodName: keyof AdminController, bodyIndex: number) {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      AdminController.prototype,
      methodName,
    ) as unknown[];
    return paramTypes?.[bodyIndex] as object | undefined;
  }

  it('uses a concrete DTO for operational policy updates', () => {
    expect((bodyMetatype('updateOperationalPolicy', 2) as { name?: string })?.name).toBe(
      'UpdateOperationalPolicyDto',
    );
  });

  it('strips unsupported operational policy fields while preserving value', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        value: 10,
        reason: '  first-pick policy update  ',
        dangerouslySetBy: 'mobile-client',
      },
      { type: 'body', metatype: bodyMetatype('updateOperationalPolicy', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('value', 10);
    expect(transformed).toHaveProperty('reason', 'first-pick policy update');
    expect(transformed).not.toHaveProperty('dangerouslySetBy');
  });

  it('uses concrete DTOs for payout administration payloads', () => {
    expect((bodyMetatype('markEarningPaid', 2) as { name?: string })?.name).toBe(
      'MarkEarningPaidDto',
    );
    expect((bodyMetatype('createPayoutBatch', 1) as { name?: string })?.name).toBe(
      'CreatePayoutBatchDto',
    );
    expect((bodyMetatype('updatePayoutBatch', 2) as { name?: string })?.name).toBe(
      'UpdatePayoutBatchDto',
    );
  });

  it('rejects blank payout batch partner ids before settlement logic runs', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { providerProfileId: '   ', transferRef: ' weekly-001 ' },
        { type: 'body', metatype: bodyMetatype('createPayoutBatch', 1) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('strips unsupported payout update fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        status: PayoutBatchStatus.PAID,
        transferRef: '  bank-001  ',
        notes: null,
        totalNetAmount: 1,
      },
      { type: 'body', metatype: bodyMetatype('updatePayoutBatch', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('status', PayoutBatchStatus.PAID);
    expect(transformed).toHaveProperty('transferRef', 'bank-001');
    expect(transformed).toHaveProperty('notes', null);
    expect(transformed).not.toHaveProperty('totalNetAmount');
  });

  it('uses concrete DTOs for service and pricing administration payloads', () => {
    expect((bodyMetatype('createService', 1) as { name?: string })?.name).toBe(
      'CreateAdminServiceDto',
    );
    expect((bodyMetatype('updateService', 2) as { name?: string })?.name).toBe(
      'UpdateAdminServiceDto',
    );
    expect((bodyMetatype('upsertServicePayoutRule', 2) as { name?: string })?.name).toBe(
      'UpsertServicePayoutRuleDto',
    );
    expect((bodyMetatype('bulkUpsertServicePayoutRules', 2) as { name?: string })?.name).toBe(
      'BulkUpsertServicePayoutRulesDto',
    );
    expect((bodyMetatype('updateServicePayoutRule', 2) as { name?: string })?.name).toBe(
      'UpdateServicePayoutRuleDto',
    );
  });

  it('normalizes service payloads and strips unsupported pricing fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        serviceGroupKey: ' body-massage ',
        name: '  Swedish Massage  ',
        durationMin: 60,
        basePrice: 500000,
        priceStep: 100000,
        displayOrder: 3,
        active: true,
        providerPayoutAmount: 380000,
      },
      { type: 'body', metatype: bodyMetatype('createService', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('serviceGroupKey', 'body-massage');
    expect(transformed).toHaveProperty('name', 'Swedish Massage');
    expect(transformed).not.toHaveProperty('providerPayoutAmount');
  });

  it('rejects invalid service payout rule numbers before pricing logic runs', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          customerPrice: 500000,
          providerPayoutAmount: 600000,
          vatBps: 1000,
          otherCostAmount: 0,
        },
        { type: 'body', metatype: bodyMetatype('upsertServicePayoutRule', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('uses concrete DTOs for booking operations payloads', () => {
    expect((bodyMetatype('addBookingOpsNote', 2) as { name?: string })?.name).toBe(
      'BookingOpsNoteDto',
    );
    expect((bodyMetatype('markBookingNoShow', 2) as { name?: string })?.name).toBe(
      'BookingOpsReasonDto',
    );
    expect((bodyMetatype('expireBooking', 2) as { name?: string })?.name).toBe(
      'BookingOpsReasonDto',
    );
    expect((bodyMetatype('closeoutCompletedBooking', 2) as { name?: string })?.name).toBe(
      'BookingCloseoutDto',
    );
    expect((bodyMetatype('updateBookingOpsTask', 2) as { name?: string })?.name).toBe(
      'BookingOpsTaskDto',
    );
  });

  it('trims booking operation notes and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        note: '  Chat evidence checked  ',
        preset: 'manual-review',
        paymentStatus: 'CAPTURED',
      },
      { type: 'body', metatype: bodyMetatype('addBookingOpsNote', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('note', 'Chat evidence checked');
    expect(transformed).toHaveProperty('preset', 'manual-review');
    expect(transformed).not.toHaveProperty('paymentStatus');
  });

  it('rejects invalid booking operation task enums', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          type: 'AUTO_ASSIGN',
          status: BookingOpsTaskStatus.DONE,
          note: 'should not be accepted',
        },
        { type: 'body', metatype: bodyMetatype('updateBookingOpsTask', 2) as never, data: '' },
      ),
    ).rejects.toThrow();

    const transformed = await pipe.transform(
      {
        type: BookingOpsTaskType.CUSTOMER_CONTACTED,
        status: BookingOpsTaskStatus.DONE,
        note: '  reviewed  ',
      },
      { type: 'body', metatype: bodyMetatype('updateBookingOpsTask', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('note', 'reviewed');
  });
});
