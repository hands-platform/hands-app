import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewFooterClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

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

  it('renders the shared footer copy for empty and bounded Partner detail tables', () => {
    expect(PartnerDetailVuexyTableFooter({ rowCount: 0 }).props.children.props.children).toBe(
      'Showing 0 entries',
    );
    expect(PartnerDetailVuexyTableFooter({ rowCount: 3 }).props.children.props.children).toBe(
      'Showing 1 to 3 of 3 entries',
    );
  });
});
