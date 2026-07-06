import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatDateTime } from '../lib/admin-format';
import { DateTimeText, dateTimeTextClassName } from './date-time-text';

describe('DateTimeText', () => {
  it('maps valid and missing values to operator-safe classes', () => {
    expect(dateTimeTextClassName('2026-06-20T09:10:00.000Z')).toBe('date-time-text');
    expect(dateTimeTextClassName(null)).toBe('date-time-text date-time-text-muted');
    expect(dateTimeTextClassName('not-a-date')).toBe('date-time-text date-time-text-muted');
  });

  it('renders valid timestamps as semantic time elements', () => {
    const value = '2026-06-20T09:10:00.000Z';
    const text = DateTimeText({ value });

    expect(text.type).toBe('time');
    expect(text.props).toMatchObject({
      className: 'date-time-text',
      dateTime: value,
      children: formatDateTime(value),
    });
  });

  it('renders fallback copy without a time datetime when value is missing', () => {
    const text = DateTimeText({ fallback: 'No clearing date', value: null });

    expect(text.type).toBe('span');
    expect(text.props).toMatchObject({
      className: 'date-time-text date-time-text-muted',
      children: 'No clearing date',
    });
    expect(text.props.dateTime).toBeUndefined();
  });

  it('keeps date time tone classes backed by global design tokens', () => {
    const globals = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
    const dateTimeBlock = cssRuleBlock(globals, '.date-time-text {');

    expect(globals).toContain('.date-time-text {');
    expect(dateTimeBlock).toContain('align-items: center;');
    expect(dateTimeBlock).toContain('display: inline-flex;');
    expect(dateTimeBlock).toContain('font-feature-settings: "tnum" 1;');
    expect(dateTimeBlock).toContain('font-size: 0.8125rem;');
    expect(dateTimeBlock).toContain('line-height: 1.35;');
    expect(dateTimeBlock).toContain('white-space: nowrap;');
    expect(globals).toContain('.date-time-text-muted {');
    expect(globals).toContain('color: var(--admin-muted);');
  });
});

function cssRuleBlock(source: string, selector: string) {
  const index = source.indexOf(selector);
  if (index < 0) {
    return '';
  }

  const endIndex = source.indexOf('}', index);
  return source.slice(index, endIndex + 1);
}
