import { renderToStaticMarkup } from 'react-dom/server';
import { AdminQueueAgeSortControls } from './admin-queue-age-sort-controls';

describe('AdminQueueAgeSortControls', () => {
  it('uses the compact desktop layout only when the caller requests it', () => {
    const html = renderToStaticMarkup(
      <AdminQueueAgeSortControls
        age="all"
        ageCounts={{ all: 0, 'under-1h': 0, '1-4h': 0, '4-24h': 0, 'over-24h': 0 }}
        ageHref={(age) => `/queue?age=${age}`}
        compact
        sort="oldest"
        sortHref={(sort) => `/queue?sort=${sort}`}
      />,
    );

    expect(html).toContain('admin-queue-age-sort-controls is-compact');
    expect(html).toContain('All ages (0)');
    expect(html).toContain('Oldest first');
  });

  it('renders the shared ageing buckets and oldest-first operation order', () => {
    const html = renderToStaticMarkup(
      <AdminQueueAgeSortControls
        age="over-24h"
        ageCounts={{ all: 12, 'under-1h': 2, '1-4h': 3, '4-24h': 4, 'over-24h': 3 }}
        ageHref={(age) => `/queue?age=${age}`}
        sla={{ overdueCount: 4, thresholdMinutes: 120 }}
        slaFilter="overdue"
        slaHref={(sla) => `/queue?sla=${sla}`}
        sort="oldest"
        sortHref={(sort) => `/queue?sort=${sort}`}
      />,
    );

    expect(html).toContain('24h+ (3)');
    expect(html).toContain('/queue?age=over-24h');
    expect(html).toContain('Oldest first');
    expect(html).toContain('/queue?sort=oldest');
    expect(html).toContain('Overdue 4');
    expect(html).toContain('/queue?sla=overdue');
    expect(html).toContain('/queue?sla=all');
    expect(html).toContain('All queue');
    expect(html).toContain('Target 2h');
  });

  it('makes an exact Start Shift SLA subset visible and clearable', () => {
    const html = renderToStaticMarkup(
      <AdminQueueAgeSortControls
        age="all"
        ageCounts={{ all: 3, 'under-1h': 0, '1-4h': 0, '4-24h': 0, 'over-24h': 3 }}
        ageHref={(age) => `/queue?age=${age}`}
        sla={{ overdueCount: 8, thresholdMinutes: 60 }}
        slaFilter="critical"
        slaHref={(sla) => `/queue?sla=${sla}`}
        sort="oldest"
        sortHref={(sort) => `/queue?sort=${sort}`}
      />,
    );

    expect(html).toContain('Showing 24h+ critical');
    expect(html).toContain('/queue?sla=all');
    expect(html).toContain('All queue');
  });
});
