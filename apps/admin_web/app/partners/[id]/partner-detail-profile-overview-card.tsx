import { Save } from 'lucide-react';

import { AdminFormControlButton, AdminFormTextarea } from '../../../components/admin-form-controls';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminProfileOverviewCard } from '../../../components/admin-overview-card';
import { AdminAvatar, adminPersonInitials } from '../../../components/admin-person-cell';
import { StatusBadge } from '../../../components/status-badge';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { updatePartnerProfileTranslations } from '../actions';

export type PartnerProfileTranslationValues = {
  readonly en: string;
  readonly ja: string;
  readonly ko: string;
  readonly zh: string;
};

export type PartnerProfileOverviewFact = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

type PartnerDetailProfileOverviewCardProps = {
  readonly avatarStatus: AdminAvatarStatus;
  readonly bioVietnamese?: string | null;
  readonly facts: readonly PartnerProfileOverviewFact[];
  readonly name: string;
  readonly partnerId: string;
  readonly statusBadges: readonly string[];
  readonly subtitle: string;
  readonly translations: PartnerProfileTranslationValues;
};

export function PartnerDetailProfileOverviewCard({
  avatarStatus,
  bioVietnamese,
  facts,
  name,
  partnerId,
  statusBadges,
  subtitle,
  translations,
}: PartnerDetailProfileOverviewCardProps) {
  return (
    <AdminProfileOverviewCard className="customer-detail-overview-card partner-detail-profile-overview-card">
      <div className="customer-detail-overview-main">
        <div className="customer-detail-identity">
          <AdminAvatar
            className="vuexy-booking-avatar customer-detail-avatar is-partner"
            initials={adminPersonInitials(name)}
            status={avatarStatus}
          />
          <div className="customer-detail-identity-copy">
            <span>Profile and contact</span>
            <h2>{name}</h2>
            <p>{subtitle}</p>
          </div>
        </div>

        <AdminFilterChipGroup className="customer-detail-badges">
          {statusBadges.map((badge) => (
            <StatusBadge key={badge} tone="info">
              {badge}
            </StatusBadge>
          ))}
        </AdminFilterChipGroup>
      </div>

      <div className="customer-detail-fact-list partner-detail-profile-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <span>{fact.label}</span>
            <strong>{marketplaceDisplayText(fact.value)}</strong>
            <small>{fact.helper}</small>
          </div>
        ))}
      </div>

      <form action={updatePartnerProfileTranslations} className="partner-profile-translation-form">
        <input name="providerId" type="hidden" value={partnerId} />
        <div className="partner-profile-translation-heading">
          <div>
            <span>About the Partner</span>
            <h3>Vietnamese source and app translations</h3>
          </div>
          <AdminFormControlButton type="submit">
            <Save aria-hidden="true" size={16} />
            Save translations
          </AdminFormControlButton>
        </div>

        <div className="partner-profile-translation-grid">
          <AdminFormTextarea
            className="partner-profile-source-bio"
            defaultValue={bioVietnamese ?? ''}
            disabled
            label="Vietnamese"
            labelVisibility="visible"
            name="bioVi"
            rows={5}
          />
          <AdminFormTextarea
            defaultValue={translations.en}
            label="English"
            labelVisibility="visible"
            maxLength={2000}
            name="bioEn"
            rows={5}
          />
          <AdminFormTextarea
            defaultValue={translations.ko}
            label="Korean"
            labelVisibility="visible"
            maxLength={2000}
            name="bioKo"
            rows={5}
          />
          <AdminFormTextarea
            defaultValue={translations.ja}
            label="Japanese"
            labelVisibility="visible"
            maxLength={2000}
            name="bioJa"
            rows={5}
          />
          <AdminFormTextarea
            defaultValue={translations.zh}
            label="Chinese"
            labelVisibility="visible"
            maxLength={2000}
            name="bioZh"
            rows={5}
          />
        </div>
      </form>
    </AdminProfileOverviewCard>
  );
}
