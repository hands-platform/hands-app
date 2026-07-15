import { renderToStaticMarkup } from 'react-dom/server';
import { adminGet } from '../../../../lib/admin-api';
import BackgroundJobIncidentPage from './page';

vi.mock('../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/admin-api')>('../../../../lib/admin-api');
  return { ...actual, adminGet: vi.fn() };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('BackgroundJobIncidentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a read-only incident and server-paginated related failures', async () => {
    mockedAdminGet.mockResolvedValue({
      failures: [{
        actor: { email: 'master@hands.vn', fullName: 'Master Admin', id: 'master-1' },
        firstSeenAt: '2026-07-14T03:00:01.000Z',
        jobId: 'repeat:monitor:1',
        reason: 'Recurring scheduler recovered.',
        status: 'RESOLVED',
        updatedAt: '2026-07-14T03:05:00.000Z',
      }],
      incident: {
        actor: { email: 'master@hands.vn', fullName: 'Master Admin', id: 'master-1' },
        firstFailureAt: '2026-07-14T03:00:00.000Z',
        firstFailureJobId: 'repeat:monitor:1',
        id: 'incident-open-1',
        jobName: 'background-job-failure-monitor',
        openedAt: '2026-07-14T03:00:01.000Z',
        queueName: 'bank-statement-escalation',
        recoveredAt: '2026-07-14T03:05:00.000Z',
        resolvedFailureCount: 1,
        status: 'RECOVERED',
      },
      page: {
        hasNextPage: true,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalCount: 11,
      },
    });

    const markup = renderToStaticMarkup(await BackgroundJobIncidentPage({
      params: Promise.resolve({ id: 'incident-open-1' }),
      searchParams: Promise.resolve({ page: '1', pageSize: '10' }),
    }));

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/system/background-jobs/incidents/incident-open-1?page=1&pageSize=10',
      null,
    );
    expect(markup).toContain('Recurring Job Incident');
    expect(markup).toContain('background-job-failure-monitor');
    expect(markup).toContain('Related failure records');
    expect(markup).toContain('repeat:monitor:1');
    expect(markup).toContain('Recurring scheduler recovered.');
    expect(markup).toContain('page=2&amp;pageSize=10');
    expect(markup).not.toContain('Retry');
  });
});
