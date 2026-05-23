-- HANDS Supabase patch: PostgREST role grants.
-- Apply this once if `hands-staging-setup.sql` was run before the grant
-- section was added to `hands-core-schema.sql`.

grant usage on schema public to anon, authenticated, service_role;

grant execute on all functions in schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.providers,
  public.provider_verifications,
  public.services,
  public.provider_services,
  public.provider_locations,
  public.customer_selected_locations,
  public.bookings,
  public.booking_services,
  public.booking_participants,
  public.chat_rooms,
  public.messages,
  public.payments,
  public.reviews,
  public.provider_payout_batches,
  public.provider_earnings,
  public.notifications,
  public.push_devices,
  public.notification_deliveries,
  public.files,
  public.location_snapshots,
  public.coupons,
  public.refunds,
  public.admin_audit_logs,
  public.admin_settings
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant select on table
  public.providers,
  public.services,
  public.provider_services,
  public.provider_locations,
  public.reviews,
  public.coupons
to anon;
