import { readFileSync } from 'node:fs';

import {
  serviceCatalogPublishBlockers,
  slugifyServiceGroupKey,
} from './service-catalog-editor-model';

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
});
