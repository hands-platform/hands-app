import { readFileSync } from 'node:fs';

import {
  serviceCatalogPublishBlockers,
  serviceCatalogReviewChangeSet,
  slugifyServiceGroupKey,
} from './service-catalog-editor-model';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';

describe('service catalog editor model', () => {
  it('auto-generates stable ASCII keys for Latin, Vietnamese, and CJK names', () => {
    expect(slugifyServiceGroupKey('Deep Tissue Massage')).toBe('deep_tissue_massage');
    expect(slugifyServiceGroupKey('Massage dưỡng sinh')).toBe('massage_duong_sinh');
    expect(slugifyServiceGroupKey('\uC544\uB85C\uB9C8 \uB9C8\uC0AC\uC9C0')).toMatch(
      /^service_[a-f0-9_]+$/u,
    );
  });

  it('returns actionable publish blockers and clears them for a complete release', () => {
    const incomplete = serviceCatalogPublishBlockers({
      impactAvailable: false,
      nameTranslations: { en: '', vi: '' },
      reason: '',
      durations: {
        60: { basePrice: '', enabled: false, providerPayoutAmount: '' },
        90: { basePrice: '', enabled: false, providerPayoutAmount: '' },
        120: { basePrice: '', enabled: false, providerPayoutAmount: '' },
      },
    });
    expect(incomplete.map((blocker) => blocker.field)).toEqual([
      'nameEn',
      'nameVi',
      'active60',
      'reason',
      'impact',
    ]);

    expect(
      serviceCatalogPublishBlockers({
        impactAvailable: true,
        nameTranslations: { en: 'Aroma Massage', vi: 'Massage huong thom' },
        reason: 'Publish complete pricing and payout rows',
        durations: {
          60: { basePrice: '500000', enabled: true, providerPayoutAmount: '300000' },
          90: { basePrice: '600000', enabled: true, providerPayoutAmount: '400000' },
          120: { basePrice: '700000', enabled: true, providerPayoutAmount: '500000' },
        },
      }),
    ).toEqual([]);
  });

  it('keeps stable client mutation keys and dangerous confirmation in the active editor', () => {
    const actionSource = readFileSync(new URL('./actions.ts', import.meta.url), 'utf8');
    const editorSource = readFileSync(new URL('./service-catalog-editor-form.tsx', import.meta.url), 'utf8');
    const drawerSource = readFileSync(new URL('./service-catalog-drawer-shell.tsx', import.meta.url), 'utf8');

    expect(actionSource).toContain("formData.get('mutationKey')");
    expect(actionSource).not.toContain('randomUUID()');
    expect(editorSource).toContain('crypto.randomUUID()');
    expect(editorSource).toContain('mutationIntentRef.current.value !== intent');
    expect(editorSource).toContain('CatalogConfirmationDialog');
    expect(editorSource).toContain('setChildModalOpen(true)');
    expect(editorSource).toContain('onCancel={closeConfirmation}');
    expect(editorSource).toContain('requestClose');
    expect(drawerSource).not.toContain('onSubmitCapture');
  });

  it('returns from same-session reauthentication to review without auto-submitting the command', () => {
    const editorSource = readFileSync(new URL('./service-catalog-editor-form.tsx', import.meta.url), 'utf8');

    expect(editorSource).toContain('AdminReauthenticateOperatorForm');
    expect(editorSource).toContain('setReauthConfirmed(true)');
    expect(editorSource).toContain('setReauthDismissed(true)');
    expect(editorSource).toContain('Review the command again, then submit it explicitly.');
    expect(editorSource).not.toContain('onSuccess={() => action(');
    const payoutInput = editorSource.slice(editorSource.indexOf('name={`providerPayoutAmount${duration}`}'));
    expect(payoutInput.slice(0, 600)).toContain('step="1"');
  });

  it.each([
    ['payout only', { providerPayoutAmount: '350000' }, true],
    ['customer price only', { basePrice: '600000' }, true],
    ['offered state only', { enabled: false }, false],
  ] as const)('builds a duration change set for a %s change', (_label, override, monetary) => {
    const changeSet = serviceCatalogReviewChangeSet({
      description: 'Relaxing massage',
      displayOrder: '10',
      durations: editorDurations(override),
      group: catalogGroup(),
      nameTranslations: { en: 'Aroma Massage', vi: 'Massage hương thơm' },
    });

    expect(changeSet.durationChanges).toHaveLength(1);
    expect(changeSet.durationChanges[0]).toMatchObject({ durationMin: 60 });
    expect(changeSet.hasMonetaryChange).toBe(monetary);
  });

  it('separates copy-only and display-order changes from monetary changes', () => {
    const copyOnly = serviceCatalogReviewChangeSet({
      description: 'Updated customer copy',
      displayOrder: '10',
      durations: editorDurations(),
      group: catalogGroup(),
      nameTranslations: { en: 'Aroma Therapy Massage', vi: 'Massage hương thơm' },
    });
    const orderOnly = serviceCatalogReviewChangeSet({
      description: 'Relaxing massage',
      displayOrder: '20',
      durations: editorDurations(),
      group: catalogGroup(),
      nameTranslations: { en: 'Aroma Massage', vi: 'Massage hương thơm' },
    });

    expect(copyOnly.durationChanges).toEqual([]);
    expect(copyOnly.hasMonetaryChange).toBe(false);
    expect(copyOnly.configChanges.map((change) => change.label)).toEqual([
      'English app name',
      'Customer-facing description',
    ]);
    expect(orderOnly.configChanges).toEqual([
      { after: '20', before: '10', label: 'Display order' },
    ]);
  });

  it('reports no changes and keeps before then after DOM order for an unchanged review', () => {
    const changeSet = serviceCatalogReviewChangeSet({
      description: 'Relaxing massage',
      displayOrder: '10',
      durations: editorDurations(),
      group: catalogGroup(),
      nameTranslations: { en: 'Aroma Massage', vi: 'Massage hương thơm' },
    });
    const editorSource = readFileSync(new URL('./service-catalog-editor-form.tsx', import.meta.url), 'utf8');
    const deltaSource = editorSource.slice(
      editorSource.indexOf('function ReviewDelta'),
      editorSource.indexOf('function TranslationInput'),
    );

    expect(changeSet).toMatchObject({
      configChanges: [],
      durationChanges: [],
      hasMonetaryChange: false,
    });
    expect(editorSource).toContain('No monetary change');
    expect(deltaSource.indexOf('{before}')).toBeLessThan(deltaSource.indexOf('{after}'));
  });
});

function editorDurations(
  sixtyMinuteOverride: Partial<{
    basePrice: string;
    enabled: boolean;
    providerPayoutAmount: string;
  }> = {},
) {
  return {
    60: {
      basePrice: '500000',
      enabled: true,
      providerPayoutAmount: '300000',
      ...sixtyMinuteOverride,
    },
    90: { basePrice: '', enabled: false, providerPayoutAmount: '' },
    120: { basePrice: '', enabled: false, providerPayoutAmount: '' },
  };
}

function catalogGroup(): ServiceCatalogGroup {
  return {
    items: [
      {
        active: true,
        basePrice: 500000,
        description: 'Relaxing massage',
        displayOrder: 10,
        durationMin: 60,
        id: 'service-aroma-60',
        name: 'Aroma Massage',
        payoutRules: [
          {
            active: true,
            currency: 'VND',
            customerPrice: 500000,
            id: 'payout-aroma-60',
            otherCostAmount: 0,
            providerPayoutAmount: 300000,
            serviceId: 'service-aroma-60',
            vatBps: 0,
          },
        ],
        priceStep: 100000,
        publicationStatus: 'PUBLISHED',
        serviceGroupKey: 'aroma_massage',
      },
    ],
    key: 'aroma_massage',
    label: 'Aroma Massage',
    nameTranslations: { en: 'Aroma Massage', vi: 'Massage hương thơm' },
  };
}
