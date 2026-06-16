import { AdminPageTemplate } from '../../components/admin-page-template';

import { CalendarClient } from './calendar-client';

export default function CalendarPage() {
  return (
    <AdminPageTemplate
      title="Operations Calendar"
      description="Vuexy-style shared calendar for operator planning, booking watch blocks, Partner review windows, customer follow-up, and finance closeout reminders."
    >
      <CalendarClient />
    </AdminPageTemplate>
  );
}
