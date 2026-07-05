import {
  adminTableGroupClassName,
  adminTablePanelChromeClassName,
} from '../../../components/admin-table-panel';

export const partnerDetailReviewCardClassName =
  `${adminTablePanelChromeClassName} ${adminTableGroupClassName} vuexy-partner-detail-review-card`;

export const partnerDetailReviewTableClassName =
  'vuexy-booking-table vuexy-partner-detail-review-table';

export const partnerDetailReviewFooterClassName =
  'vuexy-booking-table-footer vuexy-partner-detail-review-footer';

type PartnerDetailVuexyTableFooterProps = {
  readonly rowCount: number;
};

export function PartnerDetailVuexyTableFooter({
  rowCount,
}: PartnerDetailVuexyTableFooterProps) {
  return (
    <div className={partnerDetailReviewFooterClassName}>
      <span>{partnerDetailVuexyTableFooterLabel(rowCount)}</span>
    </div>
  );
}

function partnerDetailVuexyTableFooterLabel(rowCount: number) {
  if (rowCount <= 0) return 'Showing 0 entries';
  return `Showing 1 to ${rowCount} of ${rowCount} entries`;
}
