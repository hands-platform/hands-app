import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormInput,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormTextarea,
} from './admin-form-controls';

describe('Admin form controls', () => {
  it('renders Vuexy-style select and search controls with stable labels', () => {
    const select = AdminFormSelect({
      className: 'customer-select',
      defaultValue: 'completed',
      label: 'Completed reservations',
      name: 'booking',
      options: [
        { label: 'All bookings', value: '' },
        { label: 'Completed work', value: 'completed' },
      ],
    });
    const search = AdminFormSearch({
      className: 'customer-search',
      defaultValue: 'Linh',
      label: 'Search customer',
      name: 'q',
      placeholder: 'Search Customer',
    });

    expect(select.props.className).toBe('admin-form-select customer-select');
    expect(search.props.className).toBe('admin-form-search customer-search');
    expect(textContent(select)).toContain('Completed reservations');
    expect(textContent(select)).toContain('Completed work');
    expect(textContent(search)).toContain('Search customer');
  });

  it('renders date controls with the same field contract', () => {
    const date = AdminFormDate({
      className: 'partner-date-filter',
      defaultValue: '2026-06-17',
      label: 'From date',
      name: 'from',
    });

    expect(date.props.className).toBe('admin-form-date partner-date-filter');
    expect(textContent(date)).toContain('From date');
  });

  it('renders input controls with the same field contract', () => {
    const input = AdminFormInput({
      className: 'partner-reason',
      label: 'Control reason',
      maxLength: 500,
      minLength: 12,
      name: 'reason',
      placeholder: 'Clear operator reason',
      required: true,
    });

    expect(input.props.className).toBe('admin-form-input partner-reason');
    expect(textContent(input)).toContain('Control reason');
    expect(input.props.children[1].props).toMatchObject({
      maxLength: 500,
      minLength: 12,
      name: 'reason',
      placeholder: 'Clear operator reason',
      required: true,
      type: 'text',
    });
  });

  it('renders textarea controls with the same field contract', () => {
    const textarea = AdminFormTextarea({
      className: 'partner-note',
      label: 'Partner operation note',
      name: 'note',
      placeholder: 'Add factual note',
      rows: 3,
    });

    expect(textarea.props.className).toBe('admin-form-textarea partner-note');
    expect(textContent(textarea)).toContain('Partner operation note');
  });

  it('renders link and button controls without owning behavior', () => {
    const link = AdminFormControlLink({
      children: 'Export',
      className: 'customer-export',
      download: 'hands-customers.csv',
      href: 'data:text/csv,name',
    });
    const button = AdminFormControlButton({
      children: 'Apply',
      className: 'customer-apply',
    });

    expect(link.props).toMatchObject({
      className: 'admin-form-control-link customer-export',
      download: 'hands-customers.csv',
      href: 'data:text/csv,name',
    });
    expect(button.props).toMatchObject({
      className: 'admin-form-control-button customer-apply',
      type: 'submit',
    });
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
