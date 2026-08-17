import { headers } from 'next/headers';

import { AdminFormControlLink } from '../components/admin-form-light-controls';
import { AdminPageTemplate } from '../components/admin-page-template';
import { AdminErrorState } from '../components/admin-surface';

const NOT_FOUND_AREAS = [
  { backHref: '/customers', backLabel: 'Back to customers', message: 'This customer record does not exist or is no longer available.', prefix: '/customers/', title: 'Customer not found' },
  { backHref: '/partners', backLabel: 'Back to partners', message: 'This partner record does not exist or is no longer available.', prefix: '/partners/', title: 'Partner not found' },
  { backHref: '/bookings', backLabel: 'Back to bookings', message: 'This booking record does not exist or is no longer available.', prefix: '/bookings/', title: 'Booking not found' },
  { backHref: '/payments', backLabel: 'Back to payments', message: 'This payment record does not exist or is no longer available.', prefix: '/payments/', title: 'Payment not found' },
] as const;

export default async function NotFound() {
  const pathname = (await headers()).get('x-admin-pathname') ?? '';
  const state = NOT_FOUND_AREAS.find((area) => pathname.startsWith(area.prefix)) ?? {
    backHref: '/',
    backLabel: 'Return to Shift command',
    message: 'This page does not exist or is no longer available.',
    title: 'Page not found',
  };

  return (
    <AdminPageTemplate
      description={state.message}
      title={state.title}
    >
      <AdminErrorState
        action={
          <AdminFormControlLink className="button-primary" href={state.backHref}>
            {state.backLabel}
          </AdminFormControlLink>
        }
        message={state.message}
        title={state.title}
      />
    </AdminPageTemplate>
  );
}
