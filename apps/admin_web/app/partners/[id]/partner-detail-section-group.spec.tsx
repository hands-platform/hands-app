import {
  PartnerDetailDossierCluster,
  PartnerDetailReferenceDetails,
  PartnerDetailSectionGroup,
} from './partner-detail-section-group';
import { readFileSync } from 'fs';

describe('PartnerDetailSectionGroup', () => {
  it('renders a titled operations section with status and children', () => {
    const section = PartnerDetailSectionGroup({
      children: <div>Grouped partner content</div>,
      description: 'Partner operations grouped for a faster first read.',
      eyebrow: 'Control',
      id: 'partner-control-section',
      status: '4 command(s)',
      title: 'Partner control workspace',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Control');
    expect(rendered).toContain('Partner control workspace');
    expect(rendered).toContain('Partner operations grouped for a faster first read.');
    expect(rendered).toContain('4 command(s)');
    expect(rendered).toContain('Grouped partner content');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section partner-detail-section-band partner-detail-section-group',
        'ops-section-header admin-section-header partner-detail-section-band-header',
        'admin-section-body partner-detail-section-band-body partner-detail-section-group-body',
      ]),
    );
  });

  it('builds partner section groups on the shared Vuexy AdminSection surface', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain("import { AdminDisclosure, AdminSection } from '../../../components/admin-surface';");
    expect(source).toContain('<AdminSection');
    expect(source).toContain('bodyClassName="partner-detail-section-band-body partner-detail-section-group-body"');
    expect(source).toContain('headerClassName="partner-detail-section-band-header"');
    expect(source).not.toContain('<section className="partner-detail-section-band partner-detail-section-group"');
  });

  it('renders collapsible reference details for secondary summaries', () => {
    const section = PartnerDetailReferenceDetails({
      children: <div>Reference ledger</div>,
      helper: 'Secondary facts stay available without competing with approval work.',
      label: 'Reference summaries',
      status: '6 blocks',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Reference summaries');
    expect(rendered).toContain('Secondary facts stay available without competing with approval work.');
    expect(rendered).toContain('6 blocks');
    expect(rendered).toContain('Reference ledger');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-disclosure partner-detail-reference-details',
        'partner-detail-reference-details-body',
      ]),
    );
  });

  it('can open urgent reference details by default', () => {
    const section = PartnerDetailReferenceDetails({
      children: <div>Open finance reference</div>,
      defaultOpen: true,
      helper: 'Open when a finance blocker needs same-shift attention.',
      label: 'Finance-only evidence',
      status: 'Open debt',
    });

    const rendered = normalizedText(section);
    const element = readRecord(resolveElement(section));
    const props = readRecord(element?.props);

    expect(rendered).toContain('Finance-only evidence');
    expect(rendered).toContain('Open finance reference');
    expect(props?.open).toBe(true);
  });

  it('accepts Vuexy atom nodes in reference detail status slots', () => {
    const section = PartnerDetailReferenceDetails({
      children: <div>Finance details</div>,
      helper: 'Money atoms keep dense finance chips visually consistent.',
      label: 'Finance-only evidence',
      status: (
        <>
          <span className="money-text money-text-negative">120.000 VND</span> open debt
        </>
      ),
    });

    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');
    const rendered = normalizedText(section);

    expect(source).toContain('readonly status: ReactNode;');
    expect(rendered).toContain('120.000 VND open debt');
  });

  it('renders a focused dossier cluster for required evidence cards', () => {
    const section = PartnerDetailDossierCluster({
      children: <div>Required KYC and profile cards</div>,
      helper: 'Only the Level 2 approval evidence sits here.',
      label: 'Required approval evidence',
      status: '5 cards',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Required approval evidence');
    expect(rendered).toContain('Only the Level 2 approval evidence sits here.');
    expect(rendered).toContain('5 cards');
    expect(rendered).toContain('Required KYC and profile cards');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'partner-detail-dossier-cluster',
        'partner-detail-dossier-cluster-header',
        'partner-detail-dossier-cluster-body',
      ]),
    );
  });

  it('uses shared badge atoms for section and dossier status chips', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{status}</span>');
  });
});

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
