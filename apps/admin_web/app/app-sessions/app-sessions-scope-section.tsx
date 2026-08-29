import { X } from 'lucide-react';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import type { SessionFilters } from './app-sessions-page-model';

export type AppSessionQuickFilter = {
  readonly href: string;
  readonly label: string;
};

type AppSessionsScopeSectionProps = {
  readonly activeFilterHref: string;
  readonly activeFilterLabel: string;
  readonly filters: SessionFilters;
  readonly loadedCount: number;
  readonly quickFilters: readonly AppSessionQuickFilter[];
  readonly totalCount: number;
};

export function AppSessionsScopeSection({
  activeFilterHref,
  activeFilterLabel,
  filters,
  loadedCount,
  quickFilters,
  totalCount,
}: AppSessionsScopeSectionProps) {
  return (
    <AdminFilterPanel
      actions={
        <AdminFormControlLink className="button-secondary" href="/app-sessions">
          <X aria-hidden="true" size={16} />
          Clear filters
        </AdminFormControlLink>
      }
      className="admin-mb-16"
      description={`${activeFilterLabel}. Current page sample — ${loadedCount} of ${totalCount} heartbeat record(s).`}
      resultLabel={`${loadedCount}/${totalCount} loaded`}
      title="App session filters"
    >
      <AdminFormGrid action="/app-sessions" method="get">
        <AdminFormSearch
          defaultValue={filters.q ?? undefined}
          label="Search user, phone, device, IP"
          name="q"
          placeholder="Search user, phone, device, IP"
        />
        <AdminFormSelect
          defaultValue={filters.role ?? ''}
          label="Role"
          labelVisibility="visible"
          name="role"
          options={[
            { label: 'All roles', value: '' },
            { label: 'Customer sessions', value: 'CUSTOMER' },
            { label: 'Partner sessions', value: 'PROVIDER' },
          ]}
        />
        <AdminFormSelect
          defaultValue={filters.state ?? 'live'}
          label="State"
          labelVisibility="visible"
          name="state"
          options={[
            { label: 'Live heartbeat', value: 'live' },
            { label: 'Recent heartbeat', value: 'recent' },
            { label: 'Stale heartbeat', value: 'stale' },
            { label: 'Expired heartbeat', value: 'expired' },
          ]}
        />
        <AdminFormSelect
          defaultValue={filters.platform ?? ''}
          label="Platform"
          labelVisibility="visible"
          name="platform"
          options={[
            { label: 'All platforms', value: '' },
            { label: 'iOS', value: 'ios' },
            { label: 'Android', value: 'android' },
            { label: 'Web', value: 'web' },
          ]}
        />
        <AdminFormSelect
          defaultValue={String(filters.pageSize)}
          label="Rows"
          labelVisibility="visible"
          name="pageSize"
          options={[
            { label: '10 rows', value: '10' },
            { label: '25 rows', value: '25' },
            { label: '50 rows', value: '50' },
          ]}
        />
        <AdminFormActionRow wide={false}>
          <AdminFormControlButton type="submit">Apply filters</AdminFormControlButton>
        </AdminFormActionRow>
      </AdminFormGrid>
      <div className="admin-form-control-stack app-session-quick-filter-row" aria-label="App session quick filters">
        <span className="admin-form-label">Quick filters</span>
        <AdminSegmentedControl
          activeValue={activeFilterHref}
          ariaLabel="App session quick filters"
          className="app-session-quick-filter-buttons"
          options={quickFilters.map((item) => ({
            href: item.href,
            label: item.label,
            value: item.href,
          }))}
        />
      </div>
      <AdminFilterSummary
        ariaLabel="Active app session filters"
        labels={appSessionActiveFilterLabels(filters, activeFilterLabel)}
        tone="info"
      />
    </AdminFilterPanel>
  );
}

function appSessionActiveFilterLabels(filters: SessionFilters, activeFilterLabel: string) {
  const labels = [
    `Scope: ${activeFilterLabel}`,
    `Role: ${appSessionRoleLabel(filters.role)}`,
    `State: ${appSessionStateLabel(filters.state)}`,
    `Platform: ${appSessionPlatformLabel(filters.platform)}`,
    `Rows: ${filters.pageSize}`,
  ];

  if (filters.q) {
    labels.push(`Search: ${filters.q}`);
  }

  return labels;
}

function appSessionRoleLabel(role: SessionFilters['role']) {
  if (role === 'CUSTOMER') return 'Customer sessions';
  if (role === 'PROVIDER') return 'Partner sessions';
  return 'All roles';
}

function appSessionStateLabel(state: SessionFilters['state']) {
  if (state === 'recent') return 'Recent heartbeat';
  if (state === 'stale') return 'Stale heartbeat';
  if (state === 'expired') return 'Expired heartbeat';
  return 'Live heartbeat';
}

function appSessionPlatformLabel(platform: SessionFilters['platform']) {
  if (platform === 'ios') return 'iOS';
  if (platform === 'android') return 'Android';
  if (platform === 'web') return 'Web';
  return 'All platforms';
}
