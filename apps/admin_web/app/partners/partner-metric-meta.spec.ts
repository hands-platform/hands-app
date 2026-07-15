import { partnerDirectoryMetricMeta, partnerFilterSummaryMetricMeta } from './partner-metric-meta';

describe('partner metric meta', () => {
  it('separates partner directory KPI cards into live, pending, risk, and records', () => {
    expect(partnerDirectoryMetricMeta('Total partners')).toEqual({ kind: 'record', scope: 'All records' });
    expect(partnerDirectoryMetricMeta('Approved')).toEqual({ kind: 'record', scope: 'Approval records' });
    expect(partnerDirectoryMetricMeta('Online now')).toEqual({ kind: 'live', scope: 'Live' });
    expect(partnerDirectoryMetricMeta('Ready now')).toEqual({ kind: 'live', scope: 'Live' });
    expect(partnerDirectoryMetricMeta('Public media review')).toEqual({ kind: 'action', scope: 'Pending' });
    expect(partnerDirectoryMetricMeta('First earning profile')).toEqual({ kind: 'action', scope: 'Pending' });
    expect(partnerDirectoryMetricMeta('Location needs review')).toEqual({
      kind: 'risk',
      scope: 'Needs action',
    });
    expect(partnerDirectoryMetricMeta('Wallet debt')).toEqual({ kind: 'risk', scope: 'Needs action' });
    expect(partnerDirectoryMetricMeta('Account blocked')).toEqual({ kind: 'risk', scope: 'Needs action' });
  });

  it('separates partner filter snapshot cards into active filters, live readiness, pending work, and risks', () => {
    expect(partnerFilterSummaryMetricMeta('Filtered rows')).toEqual({
      kind: 'record',
      scope: 'Active filters',
    });
    expect(partnerFilterSummaryMetricMeta('Direct ready')).toEqual({ kind: 'live', scope: 'Live' });
    expect(partnerFilterSummaryMetricMeta('Marketplace ready')).toEqual({ kind: 'live', scope: 'Live' });
    expect(partnerFilterSummaryMetricMeta('Push reachable')).toEqual({ kind: 'live', scope: 'Live' });
    expect(partnerFilterSummaryMetricMeta('Approval review')).toEqual({ kind: 'action', scope: 'Pending' });
    expect(partnerFilterSummaryMetricMeta('Wallet settlement')).toEqual({
      kind: 'risk',
      scope: 'Needs action',
    });
    expect(partnerFilterSummaryMetricMeta('Location refresh')).toEqual({
      kind: 'risk',
      scope: 'Needs action',
    });
  });
});
