import { renderToStaticMarkup } from 'react-dom/server';

import {
  AdminDrawerFormGrid,
  AdminDrawerFormGridFields,
  AdminFormCheckbox,
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormControlStack,
  AdminFormDate,
  AdminFormDatePickerInput,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormGridFields,
  AdminFormInput,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormStaticValue,
  AdminFormTextarea,
} from './admin-form-controls';

describe('Admin form controls', () => {
  it('renders form grids through the shared Vuexy form surface', () => {
    const grid = AdminFormGrid({
      action: '/audit-log',
      children: 'Filters',
      className: 'compact-form audit-filter-form',
      method: 'get',
    });

    expect(grid.props).toMatchObject({
      action: '/audit-log',
      className: 'admin-form-grid form-grid compact-form audit-filter-form',
      method: 'get',
    });
    expect(textContent(grid)).toBe('Filters');
  });

  it('renders nested form field grids without creating another form element', () => {
    const fields = AdminFormGridFields({
      children: 'Two selects',
      className: 'compact-form operator-note-lanes',
    });

    expect(fields.type).toBe('div');
    expect(fields.props.className).toBe('admin-form-grid form-grid compact-form operator-note-lanes');
    expect(textContent(fields)).toBe('Two selects');
  });

  it('renders drawer form grids through the shared Vuexy drawer surface', () => {
    const form = AdminDrawerFormGrid({
      action: '/services',
      children: 'Drawer form',
      className: 'service-menu-dialog-form',
    });
    const fields = AdminDrawerFormGridFields({
      children: 'Drawer fields',
      className: 'calendar-event-fields',
    });

    expect(form.props).toMatchObject({
      action: '/services',
      className: 'calendar-form-grid service-menu-dialog-form',
    });
    expect(fields.type).toBe('div');
    expect(fields.props.className).toBe('calendar-form-grid calendar-event-fields');
    expect(textContent(form)).toBe('Drawer form');
    expect(textContent(fields)).toBe('Drawer fields');
  });

  it('renders form control stacks through the shared Vuexy helper surface', () => {
    const stack = AdminFormControlStack({
      children: 'Field plus helper',
      className: 'booking-action-note-stack',
    });

    expect(stack.props.className).toBe('admin-form-control-stack booking-action-note-stack');
    expect(textContent(stack)).toBe('Field plus helper');
  });

  it('renders form action rows through the shared Vuexy helper surface', () => {
    const row = AdminFormActionRow({
      children: 'Save changes',
      className: 'finance-reconciliation-form-actions',
    });

    expect(row.type).toBe('div');
    expect(row.props.className).toBe('admin-form-action-row form-grid-wide finance-reconciliation-form-actions');
    expect(textContent(row)).toBe('Save changes');
  });

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

  it('keeps duplicate visible select option values on unique React keys', () => {
    const select = AdminFormSelect({
      label: 'Review queue',
      name: 'review',
      options: [
        { label: 'Pending partners', value: 'pending' },
        { label: 'Pending customers', value: 'pending' },
      ],
    });
    const options = select.props.children[1].props.children;

    expect(options.map((option: { key: string }) => option.key)).toEqual(['pending-0', 'pending-1']);
    expect(options.map((option: { props: { value: string } }) => option.props.value)).toEqual([
      'pending',
      'pending',
    ]);
  });

  it('supports shell search controls without submitting a named query field', () => {
    const search = AdminFormSearch({
      autoFocus: true,
      className: 'topbar-dropdown-header',
      label: 'Search pages',
      onChange: () => undefined,
      placeholder: 'Search pages',
      value: 'book',
    });

    expect(search.props.className).toBe('admin-form-search topbar-dropdown-header');
    expect(search.props.children[2].props).toMatchObject({
      autoFocus: true,
      placeholder: 'Search pages',
      type: 'search',
      value: 'book',
    });
    expect(search.props.children[2].props.name).toBeUndefined();
  });

  it('renders date controls with the same field contract', () => {
    const date = AdminFormDate({
      className: 'partner-date-filter',
      defaultValue: '2026-06-17',
      label: 'From date',
      name: 'from',
    });

    expect(date.props.className).toBe(
      'admin-form-date admin-form-date-picker admin-form-input-date-picker partner-date-filter',
    );
    expect(textContent(date)).toContain('From date');
  });

  it('dedupes repeated Vuexy form atom classes when page hooks include base classes', () => {
    const grid = AdminFormGrid({
      children: 'Filters',
      className: 'form-grid compact-form form-grid',
    });
    const date = AdminFormDate({
      className: 'admin-form-date-picker settlement-date admin-form-input-date-picker',
      label: 'Settlement date',
      name: 'settlementDate',
    });
    const input = AdminFormInput({
      className: 'admin-form-date-picker admin-form-input-date-picker closing-period',
      label: 'Closing period',
      name: 'closingPeriod',
      type: 'month',
    });

    expect(grid.props.className).toBe('admin-form-grid form-grid compact-form');
    expect(date.props.className).toBe(
      'admin-form-date admin-form-date-picker admin-form-input-date-picker settlement-date',
    );
    expect(input.props.className).toBe(
      'admin-form-input admin-form-date-picker admin-form-input-date-picker closing-period',
    );
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
      'admin-form-date admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled finance-period',
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
      'admin-form-input admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled',
    );
    expect(input.props.children[1].props.type).toBe('datetime-local');

    const monthInput = AdminFormInput({
      label: 'Monthly tax period',
      labelVisibility: 'visible',
      name: 'period',
      type: 'month',
    });

    expect(monthInput.props.className).toBe(
      'admin-form-input admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled',
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
      'admin-form-date admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled payout-paid-at',
    );
    expect(textContent(dateTime)).toContain('Paid at');
    expect(dateTime.props.children[1].props).toMatchObject({
      defaultValue: '2026-07-03T14:30',
      name: 'paidAt',
      required: true,
      type: 'datetime-local',
    });
  });

  it('renders custom react-datepicker inputs through the shared Vuexy atom', () => {
    const markup = renderToStaticMarkup(
      <AdminFormDatePickerInput disabled label="Starts" value="03 Jul 2026, 10:00" />,
    );

    expect(markup).toContain(
      'class="admin-form-input admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled"',
    );
    expect(markup).toContain('class="admin-form-label">Starts');
    expect(markup).toContain('aria-label="Starts"');
    expect(markup).toContain('readOnly=""');
    expect(markup).toContain('value="03 Jul 2026, 10:00"');
  });

  it('renders read-only static values with the same Vuexy form shell', () => {
    const staticValue = AdminFormStaticValue({
      hiddenName: 'locale',
      hiddenValue: 'vi',
      label: 'Language',
      labelVisibility: 'visible',
      value: 'Vietnamese',
    });

    expect(staticValue.props.className).toBe('admin-form-static-value admin-form-control-labeled');
    expect(textContent(staticValue)).toContain('Language');
    expect(textContent(staticValue)).toContain('Vietnamese');
    expect(staticValue.props.children[2].props).toMatchObject({
      name: 'locale',
      type: 'hidden',
      value: 'vi',
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
      className: 'admin-form-checkbox-input',
      defaultChecked: true,
      name: 'active60',
      type: 'checkbox',
      value: 'true',
    });
    expect(checkbox.props.children[1].props).toMatchObject({
      'aria-hidden': 'true',
      className: 'admin-form-checkbox-mark',
    });
    expect(checkbox.props.children[2].props.className).toBe('admin-form-checkbox-label');
  });

  it('renders link and button controls with the shared Vuexy shell and custom hooks', () => {
    const link = AdminFormControlLink({
      'aria-label': 'Export filtered customer rows',
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
      className: 'admin-form-control-link button button-secondary customer-export',
      download: 'hands-customers.csv',
      href: 'data:text/csv,name',
      title: 'Export customers',
    });
    expect(link.props['aria-current']).toBe('page');
    expect(link.props['aria-label']).toBe('Export filtered customer rows');
    expect(button.props).toMatchObject({
      className: 'admin-form-control-button button button-primary customer-apply',
      type: 'submit',
    });
  });

  it('normalizes legacy button classes into the shared Vuexy button contract', () => {
    const link = AdminFormControlLink({
      children: 'Open payouts',
      className: 'btn btn-outline admin-inline-action',
      href: '/payouts',
    });
    const button = AdminFormControlButton({
      children: 'Approve',
      className: 'btn btn-sm btn-primary payout-action',
    });

    expect(link.props.className).toBe('admin-form-control-link button button-outline admin-inline-action');
    expect(button.props.className).toBe(
      'admin-form-control-button button button-sm button-primary payout-action',
    );
  });

  it('does not add duplicate default tones when a custom Vuexy tone is supplied', () => {
    const link = AdminFormControlLink({
      children: 'Cancel',
      className: 'button button-danger admin-inline-action',
      href: '/bookings',
    });
    const button = AdminFormControlButton({
      children: 'Save draft',
      className: 'button button-secondary setup-action',
    });

    expect(link.props.className).toBe('admin-form-control-link button button-danger admin-inline-action');
    expect(button.props.className).toBe('admin-form-control-button button button-secondary setup-action');
  });

  it('passes accessible button chrome props through the shared Vuexy button atom', () => {
    const buttonProps = {
      'aria-label': 'Close drawer',
      children: 'Close',
      className: 'button-secondary calendar-icon-button',
      title: 'Close drawer',
      type: 'button',
    } as Parameters<typeof AdminFormControlButton>[0] & {
      readonly 'aria-label': string;
      readonly title: string;
    };
    const button = AdminFormControlButton(buttonProps);

    expect(button.props['aria-label']).toBe('Close drawer');
    expect(button.props.title).toBe('Close drawer');
    expect(button.props.className).toBe(
      'admin-form-control-button button button-secondary calendar-icon-button',
    );
    expect(button.props.type).toBe('button');
  });

  it('preserves inline text links without adding the button shell', () => {
    const link = AdminFormControlLink({
      children: 'Open payment ledger',
      className: 'text-link customer-ledger-link',
      href: '/payments',
    });

    expect(link.props.className).toBe('admin-form-control-link text-link customer-ledger-link');
  });

  it('applies default Vuexy button tones when no class is supplied', () => {
    const link = AdminFormControlLink({
      children: 'Reset filters',
      href: '/customers',
    });
    const button = AdminFormControlButton({
      children: 'Save changes',
    });

    expect(link.props.className).toBe('admin-form-control-link button button-secondary');
    expect(button.props.className).toBe('admin-form-control-button button button-primary');
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
