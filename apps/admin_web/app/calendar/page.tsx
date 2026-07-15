import { headers } from 'next/headers';

import { AdminPageTemplate } from '../../components/admin-page-template';
import { adminGet, type AdminCalendarEvent } from '../../lib/admin-api';
import { getAdminWebSession } from '../../lib/admin-session';

import { CalendarClient } from './calendar-client';
import { calendarMonthGridRange } from './calendar-model';

export default async function CalendarPage() {
  const headerList = await headers();
  const session = getAdminWebSession({ headers: headerList });
  const operatorId = session?.sub ?? 'admin-web';
  const operatorName = displayOperatorName(operatorId);
  const initialRange = calendarMonthGridRange(new Date());
  const initialQuery = new URLSearchParams({
    from: initialRange.from,
    take: '200',
    to: initialRange.to,
  });
  const initialEvents = await adminGet<AdminCalendarEvent[]>(`/admin/calendar-events?${initialQuery.toString()}`, []);

  return (
    <AdminPageTemplate title="Calendar">
      <CalendarClient
        currentOperator={{ id: operatorId, name: operatorName }}
        initialEvents={initialEvents}
        initialRange={initialRange}
      />
    </AdminPageTemplate>
  );
}

function displayOperatorName(identity: string) {
  if (identity === 'admin-web') {
    return 'Admin Web';
  }

  const [name] = identity.split('@');

  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || identity;
}
