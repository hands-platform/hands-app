import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  PayoutBatchStatus,
  ProviderReportSeverity,
} from '@prisma/client';
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
    expect((bodyMetatype('markEarningPaid', 2) as { name?: string })?.name).toBe('MarkEarningPaidDto');
    expect((bodyMetatype('createPayoutBatch', 1) as { name?: string })?.name).toBe('CreatePayoutBatchDto');
    expect((bodyMetatype('updatePayoutBatch', 2) as { name?: string })?.name).toBe('UpdatePayoutBatchDto');
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
    expect((bodyMetatype('createServiceDurationSet', 1) as { name?: string })?.name).toBe(
      'CreateServiceDurationSetDto',
    );
    expect((bodyMetatype('createService', 1) as { name?: string })?.name).toBe('CreateAdminServiceDto');
    expect((bodyMetatype('updateService', 2) as { name?: string })?.name).toBe('UpdateAdminServiceDto');
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

  it('validates nested service duration options', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        serviceGroupKey: ' body-massage ',
        name: '  Body Massage  ',
        priceStep: '100000',
        durations: [{ durationMin: '60', basePrice: '500000', providerPayoutAmount: '380000', hidden: true }],
      },
      { type: 'body', metatype: bodyMetatype('createServiceDurationSet', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('serviceGroupKey', 'body-massage');
    expect(transformed.durations?.[0]).toHaveProperty('durationMin', 60);
    expect(transformed.durations?.[0]).not.toHaveProperty('hidden');
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
    expect((bodyMetatype('addBookingOpsNote', 2) as { name?: string })?.name).toBe('BookingOpsNoteDto');
    expect((bodyMetatype('markBookingNoShow', 2) as { name?: string })?.name).toBe('BookingOpsReasonDto');
    expect((bodyMetatype('expireBooking', 2) as { name?: string })?.name).toBe('BookingOpsReasonDto');
    expect((bodyMetatype('closeoutCompletedBooking', 2) as { name?: string })?.name).toBe(
      'BookingCloseoutDto',
    );
    expect((bodyMetatype('approvePostMatchCancellation', 2) as { name?: string })?.name).toBe(
      'BookingPostMatchCancellationDecisionDto',
    );
    expect((bodyMetatype('holdPostMatchCancellation', 2) as { name?: string })?.name).toBe(
      'BookingPostMatchCancellationDecisionDto',
    );
    expect((bodyMetatype('updateBookingOpsTask', 2) as { name?: string })?.name).toBe('BookingOpsTaskDto');
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

  it('uses concrete DTOs for customer and partner management payloads', () => {
    expect((bodyMetatype('addCustomerOpsNote', 2) as { name?: string })?.name).toBe('CustomerOpsNoteDto');
    expect((bodyMetatype('addProviderOpsNote', 2) as { name?: string })?.name).toBe('PartnerOpsNoteDto');
    expect((bodyMetatype('blockProviderDevice', 2) as { name?: string })?.name).toBe('AdminReasonDto');
    expect((bodyMetatype('blockProviderAccount', 2) as { name?: string })?.name).toBe('AdminReasonDto');
    expect((bodyMetatype('rejectProvider', 2) as { name?: string })?.name).toBe('AdminReasonDto');
  });

  it('uses concrete DTOs for reports, sanctions, moderation, coupons, and handoff', () => {
    expect((bodyMetatype('createProviderReport', 1) as { name?: string })?.name).toBe(
      'CreatePartnerReportDto',
    );
    expect((bodyMetatype('updateProviderReport', 2) as { name?: string })?.name).toBe(
      'UpdatePartnerReportDto',
    );
    expect((bodyMetatype('createProviderSanction', 2) as { name?: string })?.name).toBe(
      'CreatePartnerSanctionDto',
    );
    expect((bodyMetatype('moderateReview', 2) as { name?: string })?.name).toBe('ModerateReviewDto');
    expect((bodyMetatype('createCoupon', 1) as { name?: string })?.name).toBe('CreateCouponDto');
    expect((bodyMetatype('updateCoupon', 2) as { name?: string })?.name).toBe('UpdateCouponDto');
    expect((bodyMetatype('addOperationsHandoffNote', 1) as { name?: string })?.name).toBe(
      'OperationsHandoffNoteDto',
    );
  });

  it('trims customer operation notes and strips unsupported customer fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        note: '  called customer  ',
        bookingId: null,
        walletBalance: -1000,
      },
      { type: 'body', metatype: bodyMetatype('addCustomerOpsNote', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('note', 'called customer');
    expect(transformed).toHaveProperty('bookingId', null);
    expect(transformed).not.toHaveProperty('walletBalance');
  });

  it('rejects invalid report, sanction, and review enums', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          providerProfileId: 'partner-1',
          source: 'BOT',
          severity: ProviderReportSeverity.HIGH,
          category: 'kyc',
          summary: 'invalid source',
        },
        { type: 'body', metatype: bodyMetatype('createProviderReport', 1) as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { type: 'AUTO_BAN', reason: 'bad sanction type' },
        { type: 'body', metatype: bodyMetatype('createProviderSanction', 2) as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { status: 'DELETED', reportReason: 'bad review status' },
        { type: 'body', metatype: bodyMetatype('moderateReview', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('accepts admin review rating and content edits with validation', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        status: 'PUBLISHED',
        rating: '4',
        comment: '  updated review copy  ',
        reportReason: '  typo correction  ',
        unsupported: 'drop me',
      },
      { type: 'body', metatype: bodyMetatype('moderateReview', 2) as never, data: '' },
    );

    expect(transformed).toMatchObject({
      status: 'PUBLISHED',
      rating: 4,
      comment: 'updated review copy',
      reportReason: 'typo correction',
    });
    expect(transformed).not.toHaveProperty('unsupported');

    await expect(
      pipe.transform(
        { status: 'PUBLISHED', rating: '6' },
        { type: 'body', metatype: bodyMetatype('moderateReview', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('preserves coupon discount payloads while stripping unsupported coupon fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        code: '  first100  ',
        description: 'Launch coupon',
        discount: { type: 'fixed', amount: 100000 },
        active: true,
        createdByPhone: 'hidden',
      },
      { type: 'body', metatype: bodyMetatype('createCoupon', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('code', 'first100');
    expect(transformed).toHaveProperty('discount', { type: 'fixed', amount: 100000 });
    expect(transformed).not.toHaveProperty('createdByPhone');
  });
});
