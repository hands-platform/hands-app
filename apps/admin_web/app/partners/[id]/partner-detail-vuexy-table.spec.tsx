import { readFileSync } from 'node:fs';

import {
  PartnerDetailVuexyTablePanel,
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewFooterClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

const partnerDetailShellSource = readFileSync('app/partners/[id]/partner-detail-vuexy-table.tsx', 'utf8');

describe('partner detail Vuexy table shell', () => {
  it('keeps Partner detail table cards on the grouped Vuexy table shell', () => {
    expect(partnerDetailReviewCardClassName).toBe(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card',
    );
    expect(partnerDetailReviewTableClassName).toBe('vuexy-booking-table vuexy-partner-detail-review-table');
    expect(partnerDetailReviewFooterClassName).toBe(
      'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
    );
  });

  it('composes the Partner detail shell from the shared Vuexy table panel chrome token', () => {
    expect(partnerDetailShellSource).toContain('adminTablePanelChromeClassName');
    expect(partnerDetailShellSource).not.toContain(
      "'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card'",
    );
  });

  it('renders partner detail table cards through the shared Admin table panel atom', () => {
    const panel = PartnerDetailVuexyTablePanel({
      children: 'Partner rows',
      className: 'admin-mb-16',
      title: 'Partner detail rows',
    });

    expect(panel.props.className).toBe(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16',
    );
  });

  it('renders the shared footer copy for empty and bounded Partner detail tables', () => {
    expect(PartnerDetailVuexyTableFooter({ rowCount: 0 }).props.children.props.children).toBe(
      'Showing 0 entries',
    );
    expect(PartnerDetailVuexyTableFooter({ rowCount: 3 }).props.children.props.children).toBe(
      'Showing 1 to 3 of 3 entries',
    );
  });
});
