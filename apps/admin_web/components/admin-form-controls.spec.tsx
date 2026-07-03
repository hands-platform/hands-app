import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormDateTime,
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
      required: true,
    });
    const search = AdminFormSearch({
      className: 'customer-search',
      defaultValue: 'Linh',
      label: 'Search customer',
      name: 'q',
      placeholder: 'Search Customer',
    });

    expect(select.props.className).toBe('admin-form-select customer-select');
    expect(select.props.children[1].props.required).toBe(true);
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

    expect(date.props.className).toBe('admin-form-date admin-form-date-picker partner-date-filter');
    expect(textContent(date)).toContain('From date');
  });

  it('renders month controls through the shared date atom', () => {
    const month = AdminFormDate({
      className: 'finance-period',
      defaultValue: '2026-07',
      label: 'Monthly tax period',
      labelVisibility: 'visible',
      mode: 'month',
      name: 'period',
      required: true,
    });

    expect(month.props.className).toBe(
      'admin-form-date admin-form-date-picker admin-form-control-labeled finance-period',
    );
    expect(month.props.children[1].props).toMatchObject({
      defaultValue: '2026-07',
      name: 'period',
      required: true,
      type: 'month',
    });
  });

  it('renders input controls with the same field contract', () => {
    const input = AdminFormInput({
      className: 'partner-reason',
      label: 'Control reason',
      maxLength: 500,
      min: 0,
      minLength: 12,
      name: 'reason',
      placeholder: 'Clear operator reason',
      required: true,
      step: 1000,
    });

    expect(input.props.className).toBe('admin-form-input partner-reason');
    expect(textContent(input)).toContain('Control reason');
    expect(input.props.children[1].props).toMatchObject({
      maxLength: 500,
      min: 0,
      minLength: 12,
      name: 'reason',
      placeholder: 'Clear operator reason',
      required: true,
      step: 1000,
      type: 'text',
    });
  });

  it('marks native date and time inputs with the shared Vuexy date picker shell', () => {
    const input = AdminFormInput({
      label: 'Starts',
      labelVisibility: 'visible',
      name: 'startsAt',
      type: 'datetime-local',
    });

    expect(input.props.className).toBe(
      'admin-form-input admin-form-input-date-picker admin-form-control-labeled',
    );
    expect(input.props.children[1].props.type).toBe('datetime-local');

    const monthInput = AdminFormInput({
      label: 'Monthly tax period',
      labelVisibility: 'visible',
      name: 'period',
      type: 'month',
    });

    expect(monthInput.props.className).toBe(
      'admin-form-input admin-form-input-date-picker admin-form-control-labeled',
    );
    expect(monthInput.props.children[1].props.type).toBe('month');
  });

  it('renders date-time controls through a dedicated Vuexy atom', () => {
    const dateTime = AdminFormDateTime({
      className: 'payout-paid-at',
      defaultValue: '2026-07-03T14:30',
      label: 'Paid at',
      labelVisibility: 'visible',
      name: 'paidAt',
      required: true,
    });

    expect(dateTime.props.className).toBe(
      'admin-form-input admin-form-input-date-picker admin-form-control-labeled payout-paid-at',
    );
    expect(textContent(dateTime)).toContain('Paid at');
    expect(dateTime.props.children[1].props).toMatchObject({
      defaultValue: '2026-07-03T14:30',
      name: 'paidAt',
      required: true,
      type: 'datetime-local',
    });
  });

  it('can render visible field labels for operator data-entry forms', () => {
    const input = AdminFormInput({
      label: 'Approving admin ID',
      labelVisibility: 'visible',
      name: 'approvalAdminId',
      required: true,
    });
    const select = AdminFormSelect({
      label: 'Bank transaction type',
      labelVisibility: 'visible',
      name: 'type',
      options: [
        { label: 'Inflow', value: 'INFLOW' },
        { label: 'Outflow', value: 'OUTFLOW' },
      ],
    });
    const textarea = AdminFormTextarea({
      label: 'Description',
      labelVisibility: 'visible',
      name: 'description',
    });

    expect(input.props.className).toBe('admin-form-input admin-form-control-labeled');
    expect(input.props.children[0].props.className).toBe('admin-form-label');
    expect(select.props.className).toBe('admin-form-select admin-form-control-labeled');
    expect(select.props.children[0].props.className).toBe('admin-form-label');
    expect(textarea.props.className).toBe('admin-form-textarea admin-form-control-labeled');
    expect(textarea.props.children[0].props.className).toBe('admin-form-label');
  });

  it('renders textarea controls with the same field contract', () => {
    const textarea = AdminFormTextarea({
      className: 'partner-note',
      label: 'Partner operation note',
      minLength: 12,
      name: 'note',
      placeholder: 'Add factual note',
      required: true,
      rows: 3,
      textareaClassName: 'ops-note-textarea',
    });

    expect(textarea.props.className).toBe('admin-form-textarea partner-note');
    expect(textarea.props.children[1].props.className).toBe('ops-note-textarea');
    expect(textarea.props.children[1].props).toMatchObject({
      minLength: 12,
      name: 'note',
      required: true,
      rows: 3,
    });
    expect(textContent(textarea)).toContain('Partner operation note');
  });

  it('renders checkbox controls with the same field contract', () => {
    const checkbox = AdminFormCheckbox({
      children: 'Enabled',
      className: 'service-enabled-toggle',
      defaultChecked: true,
      label: '60 min option enabled',
      name: 'active60',
      value: 'true',
    });

    expect(checkbox.props.className).toBe('admin-form-checkbox service-enabled-toggle');
    expect(textContent(checkbox)).toContain('Enabled');
    expect(checkbox.props.children[0].props).toMatchObject({
      defaultChecked: true,
      name: 'active60',
      type: 'checkbox',
      value: 'true',
    });
  });

  it('renders link and button controls without owning behavior', () => {
    const link = AdminFormControlLink({
      'aria-current': 'page',
      children: 'Export',
      className: 'customer-export',
      download: 'hands-customers.csv',
      href: 'data:text/csv,name',
      title: 'Export customers',
    });
    const button = AdminFormControlButton({
      children: 'Apply',
      className: 'customer-apply',
    });

    expect(link.props).toMatchObject({
      className: 'admin-form-control-link customer-export',
      download: 'hands-customers.csv',
      href: 'data:text/csv,name',
      title: 'Export customers',
    });
    expect(link.props['aria-current']).toBe('page');
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
