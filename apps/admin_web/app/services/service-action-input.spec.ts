import {
  hasInvalidBulkPayoutRules,
  isValidServicePayout,
  isValidServicePriceStep,
  parseBulkPayoutRules,
  parseServiceInteger,
} from './service-action-input';
import { AdminApiRequestError, adminPatchOrThrow } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { revalidatePath, updateTag } from 'next/cache';
import { refreshServiceCatalog, saveServiceCatalogGroup } from './actions';
import { serviceCatalogApiFailure } from './service-catalog-action-result';
import {
  initialServiceCatalogActionState,
  initialServiceCatalogRefreshState,
} from './service-catalog-action-state';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn() }));
vi.mock('../../lib/admin-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/admin-api')>();
  return { ...actual, adminPatchOrThrow: vi.fn() };
});

describe('service action input helpers', () => {
  it('parses integer form values without accepting decimals or empty input', () => {
    expect(parseServiceInteger('100000')).toBe(100000);
    expect(parseServiceInteger(' 120000 ')).toBe(120000);
    expect(parseServiceInteger('120000.5')).toBeNull();
    expect(parseServiceInteger('')).toBeNull();
    expect(parseServiceInteger(null)).toBeNull();
  });

  it('validates service price steps', () => {
    expect(isValidServicePriceStep(300000, 100000)).toBe(true);
    expect(isValidServicePriceStep(350000, 100000)).toBe(false);
    expect(isValidServicePriceStep(300000, 50000)).toBe(false);
    expect(isValidServicePriceStep(0, 100000)).toBe(false);
  });

  it('validates provider payout against customer price', () => {
    expect(isValidServicePayout(null, 300000)).toBe(true);
    expect(isValidServicePayout(0, 300000)).toBe(true);
    expect(isValidServicePayout(250000, 300000)).toBe(true);
    expect(isValidServicePayout(350000, 300000)).toBe(false);
    expect(isValidServicePayout(-1, 300000)).toBe(false);
  });

  it('parses comma and tab separated payout ladders', () => {
    expect(parseBulkPayoutRules('300000,210000\r\n400000\t280000\n')).toEqual([
      { customerPrice: 300000, providerPayoutAmount: 210000 },
      { customerPrice: 400000, providerPayoutAmount: 280000 },
    ]);
  });

  it('flags invalid bulk payout ladders', () => {
    expect(hasInvalidBulkPayoutRules([])).toBe(true);
    expect(hasInvalidBulkPayoutRules([{ customerPrice: null, providerPayoutAmount: 100000 }])).toBe(true);
    expect(hasInvalidBulkPayoutRules([{ customerPrice: 300000, providerPayoutAmount: null }])).toBe(true);
    expect(hasInvalidBulkPayoutRules([{ customerPrice: 300000, providerPayoutAmount: 350000 }])).toBe(true);
    expect(hasInvalidBulkPayoutRules([{ customerPrice: 300000, providerPayoutAmount: 210000 }])).toBe(false);
  });

  it('maps recent reauthentication failures without exposing credential input', () => {
    const failure = serviceCatalogApiFailure(
      new AdminApiRequestError('PATCH', '/admin/services/groups/aroma_massage', 403, {
        code: 'RECENT_REAUTH_REQUIRED',
        message: 'internal guard detail',
        password: 'must-not-leak',
        mfaCode: '123456',
      }),
    );

    expect(failure).toMatchObject({
      message: expect.stringContaining('password and MFA'),
      reauthRequired: true,
    });
    expect(JSON.stringify(failure)).not.toContain('must-not-leak');
    expect(JSON.stringify(failure)).not.toContain('123456');
  });

  it('propagates recent reauthentication through the service catalog action boundary', async () => {
    vi.mocked(adminPatchOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('PATCH', '/admin/services/groups/foot', 403, {
        code: 'RECENT_REAUTH_REQUIRED',
      }),
    );
    const formData = new FormData();
    formData.set('serviceGroupKey', 'foot');
    formData.set('mutationKey', '6bb446a5-3c50-44cc-af71-6580826aab79');
    formData.set('intent', 'PUBLISH');
    formData.set('reason', 'Verify unchanged catalog command after identity confirmation.');
    formData.set('priceStep', '100000');
    formData.set('displayOrder', '10');
    formData.set('expectedVersion', '1');
    formData.set('nameEn', 'Foot Massage');
    formData.set('nameVi', 'Massage chân');
    formData.set('active60', 'on');
    formData.set('basePrice60', '700000');
    formData.set('providerPayoutAmount60', '420000');

    await expect(
      saveServiceCatalogGroup(initialServiceCatalogActionState, formData),
    ).resolves.toMatchObject({
      status: 'error',
      reauthRequired: true,
      message: expect.stringContaining('password and MFA'),
    });
  });

  it('invalidates stable catalog cache only for an authorized manual refresh', async () => {
    vi.mocked(getCurrentAdminOperatorAccess).mockResolvedValueOnce({
      categories: ['SYSTEM_SERVICES'],
      id: 'service-operator',
      roles: ['ADMIN'],
    });

    await expect(
      refreshServiceCatalog(initialServiceCatalogRefreshState),
    ).resolves.toMatchObject({ status: 'refreshed' });
    expect(updateTag).toHaveBeenCalledWith('service-catalog');
    expect(revalidatePath).toHaveBeenCalledWith('/services');

    vi.mocked(updateTag).mockClear();
    vi.mocked(revalidatePath).mockClear();
    vi.mocked(getCurrentAdminOperatorAccess).mockResolvedValueOnce({
      categories: ['CUSTOMERS'],
      id: 'customer-operator',
      roles: ['ADMIN'],
    });
    await expect(
      refreshServiceCatalog(initialServiceCatalogRefreshState),
    ).resolves.toMatchObject({ status: 'error' });
    expect(updateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
