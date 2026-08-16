-- Existing-project privacy hardening. Apply only through the reviewed Supabase SQL process.
-- Public summaries remain owned by the NestJS API; raw rows stay participant-scoped.

alter type public.file_purpose add value if not exists 'FINANCE_EVIDENCE';

drop policy if exists "bookings participant read" on public.bookings;
drop policy if exists "bookings owner and selected Partner read" on public.bookings;
create policy "bookings owner and selected Partner read"
  on public.bookings for select
  using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.providers p
      where p.id = selected_provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "booking address snapshots participant read" on public.booking_address_snapshots;
drop policy if exists "booking address snapshots owner and selected Partner read" on public.booking_address_snapshots;
create policy "booking address snapshots owner and selected Partner read"
  on public.booking_address_snapshots for select
  using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.bookings b
      join public.providers p on p.id = b.selected_provider_id
      where b.id = booking_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "reviews public read" on public.reviews;
drop policy if exists "reviews owner and subject read" on public.reviews;
create policy "reviews owner and subject read"
  on public.reviews for select
  using (
    public.is_admin()
    or customer_id = auth.uid()
    or exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

revoke select on table public.reviews from anon;
