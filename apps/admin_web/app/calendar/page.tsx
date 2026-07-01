import { headers } from 'next/headers';

import { AdminPageTemplate } from '../../components/admin-page-template';
import { getAdminWebSession } from '../../lib/admin-session';

import { CalendarClient } from './calendar-client';

export default async function CalendarPage() {
  const headerList = await headers();
  const session = getAdminWebSession({ headers: headerList });
  const operatorId = session?.sub ?? 'admin-web';
  const operatorName = displayOperatorName(operatorId);

  return (
    <AdminPageTemplate
      title="Operations Calendar"
      description="Vuexy-style shared calendar for operator planning, booking watch blocks, Partner review windows, customer follow-up, and finance closeout reminders."
    >
      <CalendarClient currentOperator={{ id: operatorId, name: operatorName }} />
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
