import { AdminStageItem, AdminStageItemLink, AdminStageList } from './admin-stage-item';

describe('AdminStageItem', () => {
  it('renders the shared Vuexy stage item class without duplicating caller classes', () => {
    const item = AdminStageItem({
      children: 'Ready queue',
      className: 'setup-stage-item finance-stage-item',
      id: 'ready-queue',
    });

    expect(item.props).toMatchObject({
      children: 'Ready queue',
      className: 'setup-stage-item finance-stage-item',
      id: 'ready-queue',
    });
  });

  it('renders link stage items with the same shared class contract', () => {
    const link = AdminStageItemLink({
      children: 'Open reconciliation',
      className: 'setup-stage-item finance-stage-item',
      href: '/finance-tax/bank-reconciliation',
      title: 'Open bank reconciliation',
    });

    expect(link.props).toMatchObject({
      children: 'Open reconciliation',
      className: 'setup-stage-item finance-stage-item',
      href: '/finance-tax/bank-reconciliation',
      title: 'Open bank reconciliation',
    });
  });

  it('renders the shared Vuexy stage list wrapper without duplicating caller classes', () => {
    const list = AdminStageList({
      children: AdminStageItem({ children: 'Ready queue' }),
      className: 'setup-stage-list admin-mt-12',
      'aria-label': 'Finance workflow',
    });

    expect(list.props).toMatchObject({
      className: 'setup-stage-list admin-mt-12',
      'aria-label': 'Finance workflow',
    });
  });
});
