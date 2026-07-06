import { readFileSync } from 'node:fs';
import { isValidElement, type ReactNode } from 'react';

import { FinanceStageList } from './finance-stage-list';

function collectClassNames(node: ReactNode): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectClassNames);
  }

  if (!isValidElement(node)) {
    return [];
  }

  if (typeof node.type === 'function' && node.type.name === 'AdminSignal') {
    const renderSignal = node.type as (props: Record<string, unknown>) => ReactNode;

    return collectClassNames(renderSignal(node.props as Record<string, unknown>));
  }

  const props = node.props as { readonly children?: ReactNode; readonly className?: unknown };
  const className = typeof props.className === 'string' ? [props.className] : [];

  return [...className, ...collectClassNames(props.children)];
}

describe('FinanceStageList', () => {
  it('uses the shared AdminSignal atom for stage markers', () => {
    const source = readFileSync('app/finance-tax/finance-stage-list.tsx', 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminStageItemLink');
    expect(source).toContain('AdminStageList');
    expect(source).not.toContain('<span>{item.signal}</span>');
    expect(source).not.toContain('<div className="setup-stage-list admin-mt-12">');
    expect(source).not.toContain('className="setup-stage-item"');
  });

  it('renders finance stage markers with Vuexy signal classes while preserving links', () => {
    const list = FinanceStageList({
      items: [
        {
          helper: 'Match company bank transactions against journal evidence.',
          href: '/finance-tax/bank-reconciliation',
          key: 'bank',
          label: 'Bank Reconciliation',
          signal: 'BANK',
          value: '2 open',
        },
      ],
    });

    const stageItem = list.props.children[0];

    expect(stageItem.props.href).toBe('/finance-tax/bank-reconciliation');
    expect(collectClassNames(list)).toContain('signal signal-info');
  });
});
