import { InfoRow } from './info-row';

describe('InfoRow', () => {
  it('renders a table row with label, detail, and value cells', () => {
    const row = InfoRow({
      detail: 'Primary app session for this operator.',
      label: 'Device',
      value: 'iOS',
    });

    expect(row.type).toBe('tr');
    expect(row.props.children).toHaveLength(2);

    const [labelCell, valueCell] = row.props.children;
    expect(labelCell.props.children[0].props.children).toBe('Device');
    expect(labelCell.props.children[1].props.children).toBe('Primary app session for this operator.');
    expect(valueCell.props.children).toBe('iOS');
  });
});
