import { AdminDataTable, AdminTableScroll } from './admin-data-table';

describe('AdminDataTable', () => {
  it('renders stable table headers and provided rows', () => {
    const table = AdminDataTable({
      children: (
        <tr>
          <td>WELCOME10</td>
          <td>Active</td>
        </tr>
      ),
      emptyMessage: 'No coupons loaded.',
      headers: ['Code', 'Status'],
      rowCount: 1,
    });

    expect(table.type).toBe('table');
    expect(table.props).toMatchObject({ className: 'table vuexy-data-table vuexy-booking-table' });
    expect(table.props.children[0].props.children.props.children).toHaveLength(2);
    expect(table.props.children[1].props.children[1]).toBeNull();
  });

  it('renders a full-width empty row when there is no data', () => {
    const table = AdminDataTable({
      children: null,
      className: 'vuexy-customer-table',
      emptyMessage: 'No feedback records loaded.',
      headers: ['Feedback', 'Action', 'Status'],
      rowCount: 0,
    });

    expect(table.props).toMatchObject({
      className: 'table vuexy-data-table vuexy-booking-table vuexy-customer-table',
    });
    const emptyRow = table.props.children[1].props.children[1];
    expect(emptyRow.props.children.props).toMatchObject({
      className: 'admin-data-table-empty-cell',
      colSpan: 3,
    });
    expect(emptyRow.props.children.props.children.props).toMatchObject({
      children: 'No feedback records loaded.',
      className: 'admin-data-table-empty',
    });
  });

  it('does not render an empty row when the caller provides no empty message', () => {
    const table = AdminDataTable({
      children: null,
      emptyMessage: null,
      headers: ['Role', 'Count'],
      rowCount: 0,
    });

    expect(table.props.children[1].props.children[1]).toBeNull();
  });

  it('does not duplicate Vuexy table classes passed by existing callers', () => {
    const table = AdminDataTable({
      children: null,
      className: 'vuexy-booking-table compact-table',
      emptyMessage: null,
      headers: ['Role'],
      rowCount: 0,
    });

    expect(table.props).toMatchObject({
      className: 'table vuexy-data-table vuexy-booking-table compact-table',
    });
  });

  it('renders a reusable scroll wrapper for wide admin tables', () => {
    const wrapper = AdminTableScroll({
      children: <table className="table" />,
    });

    expect(wrapper.type).toBe('div');
    expect(wrapper.props).toMatchObject({ className: 'admin-table-scroll' });
  });
});
