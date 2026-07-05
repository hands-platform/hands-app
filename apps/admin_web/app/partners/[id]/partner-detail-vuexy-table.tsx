import { AdminBoundedTableFooter } from '../../../components/admin-data-table';
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
  return AdminBoundedTableFooter({
    className: partnerDetailReviewFooterClassName,
    rowCount,
  });
}
