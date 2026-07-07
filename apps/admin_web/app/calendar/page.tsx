import { headers } from 'next/headers';

import { AdminPageTemplate } from '../../components/admin-page-template';
import { adminGet, type AdminCalendarEvent } from '../../lib/admin-api';
import { getAdminWebSession } from '../../lib/admin-session';

import { CalendarClient } from './calendar-client';

export default async function CalendarPage() {
  const headerList = await headers();
  const session = getAdminWebSession({ headers: headerList });
  const operatorId = session?.sub ?? 'admin-web';
  const operatorName = displayOperatorName(operatorId);
  const initialEvents = await adminGet<AdminCalendarEvent[]>('/admin/calendar-events?take=200', []);

  return (
    <AdminPageTemplate title="Operations Calendar">
      <CalendarClient currentOperator={{ id: operatorId, name: operatorName }} initialEvents={initialEvents} />
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
