import { BadRequestException } from '@nestjs/common';
import {
  PRICE_STEP_UNIT_VND,
  normalizeServiceDurationSetInput,
  normalizeServiceInput,
  normalizeServicePayoutRuleInput,
} from './admin-service-input';

describe('admin service input helpers', () => {
  it('normalizes create service input with a generated group key', () => {
    expect(
      normalizeServiceInput(
        {
          active: true,
          basePrice: 300000,
          description: '  Relaxing service  ',
          durationMin: 60,
          name: '  Massage Đặc Biệt  ',
        },
        true,
      ),
    ).toEqual({
      active: true,
      basePrice: 300000,
      description: 'Relaxing service',
      displayOrder: undefined,
      durationMin: 60,
      name: 'Massage Đặc Biệt',
      priceStep: undefined,
      serviceGroupKey: 'massage_dac_biet',
    });
  });

  it('rejects invalid service pricing increments', () => {
    expect(PRICE_STEP_UNIT_VND).toBe(100000);
    expect(() =>
      normalizeServiceInput({ basePrice: 350000, durationMin: 60, name: 'Massage' }, true),
    ).toThrow(BadRequestException);
  });

  it('normalizes service duration set input', () => {
    expect(
      normalizeServiceDurationSetInput({
        durations: [
          { basePrice: 300000, durationMin: 60 },
          { durationMin: 90 },
          { basePrice: 500000, durationMin: 120, providerPayoutAmount: 350000 },
        ],
        name: '  Massage Đặc Biệt  ',
      }),
    ).toEqual({
      displayOrder: 100,
      durationMins: [60, 120],
      durationRows: [
        { basePrice: 300000, durationMin: 60 },
        { basePrice: 500000, durationMin: 120, providerPayoutAmount: 350000 },
      ],
      groupKey: 'massage_dac_biet',
      name: 'Massage Đặc Biệt',
      priceStep: PRICE_STEP_UNIT_VND,
    });
  });

  it('rejects duration sets with missing or duplicate durations', () => {
    expect(() => normalizeServiceDurationSetInput({ name: 'Massage', durations: [] })).toThrow(
      new BadRequestException('At least one duration price is required'),
    );
    expect(() =>
      normalizeServiceDurationSetInput({
        name: 'Massage',
        durations: [
          { basePrice: 300000, durationMin: 60 },
          { basePrice: 400000, durationMin: 60 },
        ],
      }),
    ).toThrow(new BadRequestException('Duration options must be unique and explicit'));
  });

  it('normalizes payout rule input with VND defaults', () => {
    expect(
      normalizeServicePayoutRuleInput(
        { basePrice: 300000, priceStep: 100000 },
        {
          customerPrice: 400000,
          notes: '  standard  ',
          providerPayoutAmount: 280000,
        },
        true,
      ),
    ).toEqual({
      active: true,
      currency: 'VND',
      customerPrice: 400000,
      notes: 'standard',
      otherCostAmount: 0,
      providerPayoutAmount: 280000,
      vatBps: 0,
    });
  });

  it('rejects payout rules with invalid amounts', () => {
    expect(() =>
      normalizeServicePayoutRuleInput(
        { basePrice: 300000, priceStep: 100000 },
        { customerPrice: 200000, providerPayoutAmount: 100000 },
        true,
      ),
    ).toThrow(new BadRequestException('Customer price cannot be lower than the admin minimum'));

    expect(() =>
      normalizeServicePayoutRuleInput(
        { basePrice: 300000, priceStep: 100000 },
        { customerPrice: 400000, providerPayoutAmount: 500000 },
        true,
      ),
    ).toThrow(new BadRequestException('Partner payout amount cannot exceed customer price'));
  });
});
