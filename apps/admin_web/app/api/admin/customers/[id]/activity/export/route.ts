import { NextRequest, NextResponse } from 'next/server';

import type { AdminBookingDetail, AdminCustomerDetail } from '../../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../../lib/admin-api';
import { buildCsvContent } from '../../../../../../../lib/csv-export';
import { isWithinDetailDateFilter, readDetailDateFilters } from '../../../../../../../lib/detail-date-filter';
import { requireAdminWebAccess } from '../../../../../../../lib/admin-session';
import { shortId } from '../../../../../../../lib/admin-format';
import {
  CUSTOMER_ACTIVITY_TYPE_OPTIONS,
  orderCustomerActivityRecords,
  readDetailActivityOrder,
} from '../../../../../../customers/[id]/customer-detail-filters';
import {
  isWithinDetailActivityType,
  readDetailActivityType,
} from '../../../../../../../lib/detail-activity-filter';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CustomerActivityCsvRow = {
  readonly at: string;
  readonly customer_id: string;
  readonly customer_phone: string;
  readonly date: string;
  readonly detail: string;
  readonly href: string;
  readonly record_id: string;
  readonly title: string;
  readonly type: string;
};

const CUSTOMER_ACTIVITY_EXPORT_COLUMNS = [
  'type',
  'date',
  'title',
  'detail',
  'href',
  'record_id',
  'customer_id',
  'customer_phone',
] as const;
const CUSTOMER_ACTIVITY_EXPORT_LIMIT = 500;
const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: NextRequest, context: RouteContext) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const { id } = await context.params;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const dateFilters = readDetailDateFilters(searchParams);
  const activityType = readDetailActivityType(searchParams, CUSTOMER_ACTIVITY_TYPE_OPTIONS);
  const activityOrder = readDetailActivityOrder(searchParams);
  const customer = await adminGet<AdminCustomerDetail | null>(
    `/admin/customers/${encodeURIComponent(id)}?includeDiagnostics=false`,
    null,
  );

  if (!customer) {
    return NextResponse.json({ error: 'CUSTOMER_NOT_FOUND' }, { headers: NO_STORE_HEADERS, status: 404 });
  }

  const rows = orderCustomerActivityRecords(buildCustomerActivityCsvRows(customer), activityOrder)
    .filter(
      (row) =>
        isWithinDetailDateFilter(row.at, dateFilters) &&
        isWithinDetailActivityType(row.type, activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS),
    )
    .slice(0, CUSTOMER_ACTIVITY_EXPORT_LIMIT);

  const csvRows = rows.map(({ at: omittedAt, ...row }) => {
    void omittedAt;
    return row;
  });

  return new NextResponse(buildCsvContent(csvRows, [...CUSTOMER_ACTIVITY_EXPORT_COLUMNS]), {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-customer-${shortId(id)}-activity.csv"`,
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}

function buildCustomerActivityCsvRows(customer: AdminCustomerDetail): CustomerActivityCsvRow[] {
  const customerPhone = customer.user?.phone ?? '';
  const rows: CustomerActivityCsvRow[] = [];

  if (customer.user?.createdAt) {
    rows.push({
      at: customer.user.createdAt,
      customer_id: customer.id,
      customer_phone: customerPhone,
      date: customer.user.createdAt,
      detail: `${customer.user.fullName ?? 'Unnamed customer'} / ${customerPhone || 'No phone'}`,
      href: `/customers/${customer.id}`,
      record_id: customer.user.id ?? customer.id,
      title: 'Customer account created',
      type: 'ACCOUNT',
    });
  }

  for (const booking of customer.bookings ?? []) {
    rows.push(customerBookingActivityRow(customer, booking, customerPhone));
  }

  for (const notification of customer.user?.notifications ?? []) {
    rows.push({
      at: notification.createdAt,
      customer_id: customer.id,
      customer_phone: customerPhone,
      date: notification.createdAt,
      detail: notification.readAt ? `Read ${notification.readAt}` : 'Unread',
      href: '/notifications',
      record_id: notification.id,
      title: notification.title,
      type: 'NOTICE',
    });
  }

  for (const log of customer.auditLogs ?? []) {
    rows.push({
      at: log.createdAt,
      customer_id: customer.id,
      customer_phone: customerPhone,
      date: log.createdAt,
      detail: log.actor?.fullName ?? log.actor?.phone ?? 'System',
      href: '/audit-log',
      record_id: log.id,
      title: log.action,
      type: 'AUDIT',
    });
  }

  return rows.filter((row) => Boolean(row.at));
}

function customerBookingActivityRow(
  customer: AdminCustomerDetail,
  booking: AdminBookingDetail,
  customerPhone: string,
): CustomerActivityCsvRow {
  const at = booking.createdAt ?? booking.updatedAt ?? '';
  const firstService = booking.services?.[0]?.service;
  const serviceLabel = firstService
    ? `${firstService.name ?? 'Service'} / ${firstService.durationMin ?? '?'} min`
    : 'No service';

  return {
    at,
    customer_id: customer.id,
    customer_phone: customerPhone,
    date: at,
    detail: serviceLabel,
    href: `/bookings/${booking.id}`,
    record_id: booking.id,
    title: `${booking.status} booking ${shortId(booking.id)}`,
    type: booking.status === 'COMPLETED' ? 'WORK' : 'BOOKING',
  };
}
