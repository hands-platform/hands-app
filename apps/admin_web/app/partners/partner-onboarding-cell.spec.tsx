import type { ActionMenuItem } from '../../components/action-menu';
import type { AdminProvider } from '../../lib/admin-api';
import {
  PartnerOnboardingCell,
  type PartnerOnboardingCellBankAccount,
  type PartnerOnboardingCellDocument,
} from './partner-onboarding-cell';

describe('PartnerOnboardingCell', () => {
  it('renders Partner onboarding status, documents, bank, tax, and review actions', () => {
    const cell = PartnerOnboardingCell({
      bankActions: bankActions,
      documentActions: documentActions,
      kycActions: kycActions,
      partnerName: 'Linh Wellness',
      provider: {
        agreements: [{ id: 'agreement-1' }, { id: 'agreement-2' }],
        bankAccounts: [
          {
            accountHolderName: 'Linh Nguyen',
            accountNumberMasked: '****1234',
            bankName: 'Vietcombank',
            id: 'bank-1',
            status: 'APPROVED',
          },
        ],
        documents: [
          {
            fileAsset: {
              contentType: 'image/jpeg',
              id: 'asset-1',
              key: 'private/cccd-front.jpg',
              sizeBytes: 2048,
              uploadedAt: '2026-06-08T08:00:00.000Z',
            },
            id: 'doc-1',
            status: 'APPROVED',
            type: 'CCCD_FRONT',
          },
        ],
        id: 'partner-onboarding',
        kyc: {
          cccdNumberLast4: '6789',
          status: 'APPROVED',
        },
        legalName: 'Linh Wellness LLC',
        level: 'LEVEL_2_ACTIVE',
        taxProfile: {
          id: 'tax-1',
          registeredAddress: 'District 1, Ho Chi Minh City',
          status: 'PENDING_REVIEW',
          taxCodeLast4: '4321',
        },
        verification: {
          status: 'PENDING_REVIEW',
        },
      } as AdminProvider,
      taxActions: taxActions,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('LEVEL_2_ACTIVE');
    expect(rendered).toContain('KYC APPROVED');
    expect(rendered).toContain('Bank APPROVED');
    expect(rendered).toContain('Tax PENDING_REVIEW');
    expect(rendered).toContain('Legal: Linh Wellness LLC / CCCD ****6789');
    expect(rendered).toContain('Agreements: 2 /5 (3 missing)');
    expect(rendered).toContain('Vietcombank / ****1234 / Linh Nguyen');
    expect(rendered).toContain('Tax code **** 4321 / District 1, Ho Chi Minh City');
    expect(rendered).toContain('Typed documents');
    expect(rendered).toContain('CCCD front side APPROVED');
    expect(rendered).toContain('image/jpeg / 2.0 KB');
    expect(rendered).toContain('private/cccd-front.jpg');
    expect(rendered).toContain('Review KYC');
    expect(rendered).toContain('Review bank');
    expect(rendered).toContain('Review tax');
    expect(hrefsIn(cell)).toEqual(
      expect.arrayContaining([
        '/partners/partner-onboarding#documents',
        '/partners/partner-onboarding/documents/doc-1/review',
        '/partners/partner-onboarding/kyc/review',
        '/partners/partner-onboarding/bank/bank-1/review',
        '/partners/partner-onboarding/tax/tax-1/review',
      ]),
    );
    expect(ariaLabelsIn(cell)).toEqual(
      expect.arrayContaining([
        'CCCD front side review actions for Linh Wellness',
        'KYC review actions for Linh Wellness',
        'Bank review actions for Linh Wellness',
        'Legacy tax profile review actions for Linh Wellness',
      ]),
    );
    expect(classNamesIn(cell)).toEqual(
      expect.arrayContaining([
        'provider-file-row',
        'pill pill-success',
        'pill pill-warn',
        'admin-form-control-link text-link',
      ]),
    );
  });

  it('renders missing onboarding fallbacks and blocked KYC approval helper', () => {
    const cell = PartnerOnboardingCell({
      bankActions: bankActions,
      documentActions: documentActions,
      kycActions: kycActions,
      partnerName: 'Draft Partner',
      provider: {
        agreements: [],
        displayName: 'Draft Partner',
        id: 'partner-draft',
        status: 'PENDING_REVIEW',
      } as AdminProvider,
      taxActions: taxActions,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('LEVEL_1_SIGNUP');
    expect(rendered).toContain('KYC DRAFT');
    expect(rendered).toContain('Bank MISSING');
    expect(rendered).toContain('Legal name not saved');
    expect(rendered).toContain('Agreements: 0 /5 (5 missing)');
    expect(rendered).toContain('No typed partner documents yet.');
    expect(rendered).toContain('KYC approval unlocks after CCCD front, CCCD back, and selfie documents are approved.');
    expect(rendered).toContain('Review KYC');
  });
});

function documentActions(
  providerId: string,
  document: PartnerOnboardingCellDocument,
): readonly ActionMenuItem[] {
  return [
    {
      href: `/partners/${providerId}/documents/${document.id}/review`,
      kind: 'link',
      label: 'Review document',
      tone: 'info',
    },
  ];
}

function kycActions(provider: AdminProvider): readonly ActionMenuItem[] {
  return [
    {
      href: `/partners/${provider.id}/kyc/review`,
      kind: 'link',
      label: 'Review KYC',
      tone: 'info',
    },
  ];
}

function bankActions(
  providerId: string,
  bank: PartnerOnboardingCellBankAccount,
): readonly ActionMenuItem[] {
  return [
    {
      href: `/partners/${providerId}/bank/${bank.id}/review`,
      kind: 'link',
      label: 'Review bank',
      tone: 'info',
    },
  ];
}

function taxActions(provider: AdminProvider): readonly ActionMenuItem[] {
  return [
    {
      href: `/partners/${provider.id}/tax/${provider.taxProfile?.id ?? 'missing'}/review`,
      kind: 'link',
      label: 'Review tax',
      tone: 'info',
    },
  ];
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function ariaLabelsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(ariaLabelsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const label = typeof props?.['aria-label'] === 'string' ? [props['aria-label']] : [];
  return [...label, ...ariaLabelsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
