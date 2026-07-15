-- HANDS Supabase patch: PostgREST role grants.
-- Apply this once if `hands-staging-setup.sql` was run before the grant
-- section was added to `hands-core-schema.sql`.

grant usage on schema public to anon, authenticated, service_role;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated, service_role;
revoke execute on function public.nearby_providers(double precision, double precision, integer)
from public, anon, authenticated;
grant execute on function public.nearby_providers(double precision, double precision, integer)
to service_role;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke usage, select on all sequences in schema public from anon, authenticated;

grant select on table
  public.profiles,
  public.providers,
  public.provider_verifications,
  public.provider_profiles,
  public.provider_kyc,
  public.provider_documents,
  public.provider_bank_accounts,
  public.provider_tax_profiles,
  public.services,
  public.provider_services,
  public.provider_locations,
  public.customer_selected_locations,
  public.bookings,
  public.booking_address_snapshots,
  public.booking_services,
  public.booking_participants,
  public.chat_rooms,
  public.messages,
  public.payments,
  public.reviews,
  public.provider_payout_batches,
  public.provider_payouts,
  public.provider_earnings,
  public.tax_policy_versions,
  public.tax_rules,
  public.provider_tax_logs,
  public.withholding_logs,
  public.provider_agreements,
  public.provider_verification_logs,
  public.provider_sessions,
  public.provider_devices,
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
  public.reviews,
  public.coupons
to anon;
