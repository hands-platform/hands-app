-- HANDS Supabase core schema draft.
-- Run in Supabase SQL editor after reviewing project-specific admin claims.
-- This is designed as a migration target while the MVP still routes critical
-- booking, payment, and matching writes through the NestJS API.

create extension if not exists pgcrypto;
create extension if not exists postgis;

do $$
begin
  create type public.user_role as enum ('CUSTOMER', 'PROVIDER', 'ADMIN');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_status as enum (
    'OFFLINE',
    'ONLINE_AVAILABLE',
    'ONLINE_BUSY',
    'ONLINE_AVAILABLE_SOON'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.booking_status as enum (
    'CREATED',
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
    'EXPIRED',
    'REFUNDED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum (
    'PENDING',
    'AUTHORIZED',
    'CAPTURED',
    'FAILED',
    'REFUNDED',
    'RELEASED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_method as enum (
    'MOMO',
    'VNPAY',
    'CASH',
    'CARD',
    'BANK_TRANSFER',
    'CUSTOMER_WALLET',
    'MANUAL'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.verification_status as enum ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.participant_status as enum ('JOINED', 'ACCEPTED', 'REJECTED', 'SELECTED', 'EXPIRED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.review_status as enum ('PUBLISHED', 'HIDDEN', 'REPORTED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.earning_status as enum ('PENDING', 'AVAILABLE', 'PAID', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payout_batch_status as enum ('DRAFT', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.file_visibility as enum ('PUBLIC', 'PRIVATE');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.file_purpose as enum (
    'PROVIDER_VERIFICATION',
    'PROVIDER_GALLERY',
    'CHAT_ATTACHMENT',
    'PROFILE_IMAGE'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.file_upload_status as enum ('PENDING', 'UPLOADED', 'FAILED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.file_review_status as enum ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'CUSTOMER',
  phone text,
  display_name text,
  avatar_url text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null default 'massage',
  bio text,
  status public.provider_status not null default 'OFFLINE',
  verification_status public.verification_status not null default 'DRAFT',
  feedback_record_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.provider_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null unique references public.providers(id) on delete cascade,
  status public.verification_status not null default 'DRAFT',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  base_price_vnd integer not null check (base_price_vnd >= 0),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  price_vnd integer not null check (price_vnd >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, service_id, duration_minutes)
);

create table if not exists public.provider_locations (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography(point, 4326)
    generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_selected_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  preferred_provider_id uuid references public.providers(id),
  selected_provider_id uuid references public.providers(id),
  status public.booking_status not null default 'CREATED',
  address_text text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  subtotal_vnd integer not null default 0,
  total_vnd integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_address_snapshots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  address_text text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography(point, 4326)
    generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  source text not null default 'CUSTOMER_SELECTED',
  created_at timestamptz not null default now()
);

create table if not exists public.booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  service_id uuid not null references public.services(id),
  provider_service_id uuid references public.provider_services(id),
  name text not null,
  duration_minutes integer not null,
  price_vnd integer not null
);

create table if not exists public.booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  role text not null default 'BACKUP',
  status public.participant_status not null default 'JOINED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, provider_id)
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.providers(id),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  method public.payment_method not null,
  status public.payment_status not null default 'PENDING',
  amount_vnd integer not null check (amount_vnd >= 0),
  provider_reference text,
  raw_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.providers(id),
  feedback_label text not null default 'SERVICE_FEEDBACK',
  body text,
  status public.review_status not null default 'PUBLISHED',
  report_reason text,
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_payout_batches (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id),
  total_net_amount_vnd integer not null check (total_net_amount_vnd >= 0),
  currency text not null default 'VND',
  status public.payout_batch_status not null default 'DRAFT',
  transfer_reference text,
  notes text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.provider_earnings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  gross_amount_vnd integer not null check (gross_amount_vnd >= 0),
  platform_fee_vnd integer not null check (platform_fee_vnd >= 0),
  withholding_amount_vnd integer not null default 0 check (withholding_amount_vnd >= 0),
  net_amount_vnd integer not null check (net_amount_vnd >= 0),
  currency text not null default 'VND',
  status public.earning_status not null default 'PENDING',
  available_at timestamptz,
  paid_at timestamptz,
  payout_batch_id uuid references public.provider_payout_batches(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'CUSTOMER',
  token text not null unique,
  platform text not null,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  push_device_id uuid not null references public.push_devices(id) on delete cascade,
  provider text not null,
  status text not null,
  response jsonb,
  attempted_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider_verification_id uuid references public.provider_verifications(id) on delete set null,
  bucket text not null,
  path text not null,
  visibility public.file_visibility not null default 'PRIVATE',
  purpose public.file_purpose not null default 'PROVIDER_VERIFICATION',
  upload_status public.file_upload_status not null default 'PENDING',
  review_status public.file_review_status not null default 'PENDING_REVIEW',
  reviewed_at timestamptz,
  review_reason text,
  reviewed_by_id uuid references public.profiles(id) on delete set null,
  content_type text,
  uploaded_at timestamptz,
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table if not exists public.location_snapshots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  provider_id uuid not null references public.providers(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  recorded_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount jsonb not null,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount_vnd integer not null check (amount_vnd >= 0),
  reason text,
  status text not null default 'REQUESTED',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  target text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists providers_user_idx on public.providers(user_id);
create index if not exists providers_status_idx on public.providers(status);
create index if not exists providers_status_updated_idx on public.providers(status, updated_at desc);
create index if not exists provider_verifications_status_idx on public.provider_verifications(status);
create index if not exists provider_locations_location_idx on public.provider_locations using gist(location);
create index if not exists provider_locations_updated_idx on public.provider_locations(updated_at desc);
create index if not exists customer_selected_locations_customer_idx
  on public.customer_selected_locations(customer_id, created_at desc);
create index if not exists bookings_customer_idx on public.bookings(customer_id, created_at desc);
create index if not exists bookings_preferred_provider_idx on public.bookings(preferred_provider_id, created_at desc);
create index if not exists bookings_selected_provider_idx on public.bookings(selected_provider_id, created_at desc);
create index if not exists bookings_status_idx on public.bookings(status, created_at desc);
create index if not exists booking_address_snapshots_booking_idx
  on public.booking_address_snapshots(booking_id);
create index if not exists booking_address_snapshots_location_idx
  on public.booking_address_snapshots using gist(location);
create index if not exists booking_services_booking_idx on public.booking_services(booking_id);
create index if not exists booking_services_service_idx on public.booking_services(service_id);
create index if not exists booking_participants_provider_idx
  on public.booking_participants(provider_id, created_at desc);
create index if not exists booking_participants_status_idx
  on public.booking_participants(status, created_at desc);
create index if not exists messages_room_idx on public.messages(chat_room_id, created_at desc);
create index if not exists messages_sender_idx on public.messages(sender_id, created_at desc);
create index if not exists provider_earnings_provider_idx on public.provider_earnings(provider_id, created_at desc);
create index if not exists provider_earnings_status_idx on public.provider_earnings(status, created_at desc);
create index if not exists provider_payout_batches_provider_idx on public.provider_payout_batches(provider_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_read_idx on public.notifications(user_id, read_at, created_at desc);
create index if not exists push_devices_user_idx on public.push_devices(user_id, created_at desc);
create index if not exists push_devices_user_role_enabled_idx on public.push_devices(user_id, role, enabled);
create index if not exists notification_deliveries_notification_idx
  on public.notification_deliveries(notification_id, attempted_at desc);
create index if not exists notification_deliveries_push_device_idx
  on public.notification_deliveries(push_device_id, attempted_at desc);
create index if not exists notification_deliveries_provider_status_idx
  on public.notification_deliveries(provider, status, attempted_at desc);
create index if not exists notification_deliveries_status_idx
  on public.notification_deliveries(status, attempted_at desc);
create index if not exists files_owner_idx on public.files(owner_id, created_at desc);
create index if not exists files_owner_purpose_idx on public.files(owner_id, purpose, created_at desc);
create index if not exists files_visibility_purpose_idx on public.files(visibility, purpose, created_at desc);
create index if not exists files_review_status_purpose_idx on public.files(review_status, purpose, created_at desc);
create index if not exists location_snapshots_provider_idx on public.location_snapshots(provider_id, recorded_at desc);
create index if not exists location_snapshots_booking_idx on public.location_snapshots(booking_id, recorded_at desc);
create index if not exists coupons_active_window_idx on public.coupons(active, starts_at, ends_at);
create index if not exists refunds_booking_idx on public.refunds(booking_id, created_at desc);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
  );
$$;

create or replace function public.nearby_providers(
  input_lat double precision,
  input_lng double precision,
  radius_meters integer default 5000
)
returns table (
  provider_id uuid,
  name text,
  category text,
  status public.provider_status,
  latitude double precision,
  longitude double precision,
  updated_at timestamptz,
  distance_meters integer,
  is_recent_location boolean
)
language sql
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(input_lng, input_lat), 4326)::geography as point
  )
  select
    p.id,
    p.name,
    p.category,
    p.status,
    pl.latitude,
    pl.longitude,
    pl.updated_at,
    round(st_distance(pl.location, origin.point) / 100.0)::integer * 100,
    pl.updated_at >= now() - interval '30 minutes'
  from public.providers p
  join public.provider_locations pl on pl.provider_id = p.id
  cross join origin
  where p.status in ('ONLINE_AVAILABLE', 'ONLINE_AVAILABLE_SOON')
    and pl.updated_at >= now() - interval '24 hours'
    and st_dwithin(pl.location, origin.point, radius_meters)
  order by st_distance(pl.location, origin.point), p.status;
$$;

alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.provider_verifications enable row level security;
alter table public.services enable row level security;
alter table public.provider_services enable row level security;
alter table public.provider_locations enable row level security;
alter table public.customer_selected_locations enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_address_snapshots enable row level security;
alter table public.booking_services enable row level security;
alter table public.booking_participants enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.provider_payout_batches enable row level security;
alter table public.provider_earnings enable row level security;
alter table public.notifications enable row level security;
alter table public.push_devices enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.files enable row level security;
alter table public.location_snapshots enable row level security;
alter table public.coupons enable row level security;
alter table public.refunds enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_settings enable row level security;

drop policy if exists "profiles owner read" on public.profiles;
create policy "profiles owner read"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "providers public approved read" on public.providers;
create policy "providers public approved read"
  on public.providers for select
  using (verification_status = 'APPROVED' or user_id = auth.uid() or public.is_admin());

drop policy if exists "providers owner update" on public.providers;
create policy "providers owner update"
  on public.providers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "provider verifications owner or admin read" on public.provider_verifications;
create policy "provider verifications owner or admin read"
  on public.provider_verifications for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "services public read" on public.services;
create policy "services public read"
  on public.services for select
  using (status = 'ACTIVE' or public.is_admin());

drop policy if exists "provider services public read" on public.provider_services;
create policy "provider services public read"
  on public.provider_services for select
  using (status = 'ACTIVE' or public.is_admin());

drop policy if exists "recent provider locations read" on public.provider_locations;
drop policy if exists "provider locations owner or admin read" on public.provider_locations;
create policy "provider locations owner or admin read"
  on public.provider_locations for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "provider owner location upsert" on public.provider_locations;
create policy "provider owner location upsert"
  on public.provider_locations for all
  using (
    exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "customer selected locations owner" on public.customer_selected_locations;
create policy "customer selected locations owner"
  on public.customer_selected_locations for all
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid());

drop policy if exists "bookings participant read" on public.bookings;
create policy "bookings participant read"
  on public.bookings for select
  using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.providers p
      where p.id in (preferred_provider_id, selected_provider_id)
        and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.booking_participants bp
      join public.providers p on p.id = bp.provider_id
      where bp.booking_id = bookings.id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "booking address snapshots participant read" on public.booking_address_snapshots;
create policy "booking address snapshots participant read"
  on public.booking_address_snapshots for select
  using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.bookings b
      join public.providers p on p.id in (b.preferred_provider_id, b.selected_provider_id)
      where b.id = booking_id
        and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.booking_participants bp
      join public.providers p on p.id = bp.provider_id
      where bp.booking_id = booking_address_snapshots.booking_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "chat rooms participants read" on public.chat_rooms;
create policy "chat rooms participants read"
  on public.chat_rooms for select
  using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "messages participants read" on public.messages;
create policy "messages participants read"
  on public.messages for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.chat_rooms cr
      left join public.providers p on p.id = cr.provider_id
      where cr.id = messages.chat_room_id
        and (cr.customer_id = auth.uid() or p.user_id = auth.uid())
    )
  );

drop policy if exists "messages participants insert" on public.messages;
create policy "messages participants insert"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.chat_rooms cr
      left join public.providers p on p.id = cr.provider_id
      where cr.id = chat_room_id
        and (cr.customer_id = auth.uid() or p.user_id = auth.uid())
    )
  );

drop policy if exists "payments owner read" on public.payments;
create policy "payments owner read"
  on public.payments for select
  using (customer_id = auth.uid() or public.is_admin());

drop policy if exists "provider earnings owner read" on public.provider_earnings;
create policy "provider earnings owner read"
  on public.provider_earnings for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "provider payout batches owner read" on public.provider_payout_batches;
create policy "provider payout batches owner read"
  on public.provider_payout_batches for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read"
  on public.reviews for select
  using (true);

drop policy if exists "notifications owner read" on public.notifications;
create policy "notifications owner read"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications owner update" on public.notifications;
create policy "notifications owner update"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push devices owner read" on public.push_devices;
create policy "push devices owner read"
  on public.push_devices for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "push devices owner write" on public.push_devices;
create policy "push devices owner write"
  on public.push_devices for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notification deliveries owner read" on public.notification_deliveries;
create policy "notification deliveries owner read"
  on public.notification_deliveries for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.notifications n
      where n.id = notification_id
        and n.user_id = auth.uid()
    )
  );

drop policy if exists "files owner read" on public.files;
create policy "files owner read"
  on public.files for select
  using (visibility = 'PUBLIC' or owner_id = auth.uid() or public.is_admin());

drop policy if exists "location snapshots participant read" on public.location_snapshots;
create policy "location snapshots participant read"
  on public.location_snapshots for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.bookings b
      where b.id = booking_id and b.customer_id = auth.uid()
    )
  );

drop policy if exists "coupons active read" on public.coupons;
create policy "coupons active read"
  on public.coupons for select
  using (active = true or public.is_admin());

drop policy if exists "refunds owner read" on public.refunds;
create policy "refunds owner read"
  on public.refunds for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.bookings b
      where b.id = booking_id and b.customer_id = auth.uid()
    )
  );

drop policy if exists "admin audit logs admin only" on public.admin_audit_logs;
create policy "admin audit logs admin only"
  on public.admin_audit_logs for select
  using (public.is_admin());

drop policy if exists "admin settings admin only" on public.admin_settings;
create policy "admin settings admin only"
  on public.admin_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- Provider onboarding extension: KYC, tax, payout gating, agreements, and device security.
-- This section is additive so the NestJS API can keep existing MVP flows while Supabase
-- becomes the source for provider onboarding data.

do $$
begin
  create type public.provider_level as enum (
    'LEVEL_1_SIGNUP',
    'LEVEL_2_ACTIVE',
    'LEVEL_3_PAYOUT_ENABLED',
    'LEVEL_4_TRUSTED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_kyc_status as enum ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_document_type as enum (
    'CCCD_FRONT',
    'CCCD_BACK',
    'SELFIE',
    'PROFILE_PHOTO',
    'WORK_PHOTO',
    'BANK_QR'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_document_status as enum ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_bank_account_status as enum (
    'DRAFT',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'DISABLED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_tax_profile_status as enum ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tax_policy_status as enum ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tax_rule_scope as enum ('DEFAULT', 'SERVICE_TYPE', 'AMOUNT_BAND');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.provider_agreement_type as enum ('TERMS', 'PRIVACY', 'LOCATION', 'PAYOUT', 'TAX');
exception
  when duplicate_object then null;
end $$;

alter table public.providers
  add column if not exists level public.provider_level not null default 'LEVEL_1_SIGNUP',
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists trusted_at timestamptz,
  add column if not exists deleted_at timestamptz;

create table if not exists public.provider_profiles (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  legal_name text,
  date_of_birth date,
  gender text,
  phone text,
  facebook_id text,
  activity_nickname text,
  residential_address text,
  city text,
  service_area jsonb,
  experience text,
  specialties text[],
  languages text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_kyc (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  cccd_number_hash text,
  cccd_number_last4 text,
  status public.provider_kyc_status not null default 'DRAFT',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  type public.provider_document_type not null,
  status public.provider_document_status not null default 'PENDING_REVIEW',
  reviewed_at timestamptz,
  rejection_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  bank_name text not null,
  account_number_masked text,
  account_number_last4 text,
  account_holder_name text not null,
  qr_banking_info jsonb,
  status public.provider_bank_account_status not null default 'PENDING_REVIEW',
  is_primary boolean not null default false,
  reviewed_at timestamptz,
  rejection_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_tax_profiles (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  tax_code_hash text,
  tax_code_last4 text,
  legal_name text not null,
  registered_address text not null,
  status public.provider_tax_profile_status not null default 'PENDING_REVIEW',
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_policy_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.tax_policy_status not null default 'DRAFT',
  effective_from timestamptz not null,
  effective_to timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.tax_policy_versions(id) on delete cascade,
  scope public.tax_rule_scope not null default 'DEFAULT',
  service_type text,
  min_gross_amount integer,
  max_gross_amount integer,
  rate_bps integer not null default 0 check (rate_bps between 0 and 10000),
  fixed_amount integer not null default 0 check (fixed_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_tax_logs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  earning_id uuid references public.provider_earnings(id) on delete set null,
  tax_profile_id uuid references public.provider_tax_profiles(provider_id) on delete set null,
  policy_version_id uuid references public.tax_policy_versions(id) on delete set null,
  gross_amount integer not null,
  taxable_amount integer not null,
  withholding_amount integer not null,
  currency text not null default 'VND',
  rule_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.withholding_logs (
  id uuid primary key default gen_random_uuid(),
  provider_tax_log_id uuid not null references public.provider_tax_logs(id) on delete cascade,
  payout_batch_id uuid references public.provider_payout_batches(id) on delete set null,
  amount integer not null,
  status text not null default 'PENDING',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_payouts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  payout_batch_id uuid references public.provider_payout_batches(id) on delete set null,
  requested_amount integer not null,
  withholding_amount integer not null default 0,
  final_amount integer not null,
  status text not null default 'REQUESTED',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  notes text
);

create table if not exists public.provider_agreements (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  type public.provider_agreement_type not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  device_id text,
  unique (provider_id, type, version)
);

create table if not exists public.provider_verification_logs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_sessions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  device_id text,
  ip_address text,
  app_version text,
  logged_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  suspicious boolean not null default false,
  suspicious_reason text
);

create table if not exists public.provider_devices (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  device_id text not null,
  platform text,
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz,
  blocked_at timestamptz,
  block_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, device_id)
);

create index if not exists provider_documents_provider_idx on public.provider_documents(provider_id, type, status);
create index if not exists provider_bank_accounts_provider_idx on public.provider_bank_accounts(provider_id, status);
create index if not exists tax_policy_versions_active_idx on public.tax_policy_versions(status, effective_from desc);
create index if not exists tax_rules_policy_idx on public.tax_rules(policy_version_id, scope, active);
create index if not exists provider_tax_logs_provider_idx on public.provider_tax_logs(provider_id, created_at desc);
create index if not exists withholding_logs_payout_idx on public.withholding_logs(payout_batch_id, status);
create index if not exists provider_payouts_provider_idx on public.provider_payouts(provider_id, requested_at desc);
create index if not exists provider_sessions_provider_idx on public.provider_sessions(provider_id, last_seen_at desc);
create index if not exists provider_devices_provider_idx on public.provider_devices(provider_id, enabled);

alter table public.provider_profiles enable row level security;
alter table public.provider_kyc enable row level security;
alter table public.provider_documents enable row level security;
alter table public.provider_bank_accounts enable row level security;
alter table public.provider_tax_profiles enable row level security;
alter table public.tax_policy_versions enable row level security;
alter table public.tax_rules enable row level security;
alter table public.provider_tax_logs enable row level security;
alter table public.withholding_logs enable row level security;
alter table public.provider_payouts enable row level security;
alter table public.provider_agreements enable row level security;
alter table public.provider_verification_logs enable row level security;
alter table public.provider_sessions enable row level security;
alter table public.provider_devices enable row level security;

drop policy if exists "provider onboarding owner or admin read" on public.provider_profiles;
create policy "provider onboarding owner or admin read"
  on public.provider_profiles for select
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider onboarding owner write" on public.provider_profiles;
create policy "provider onboarding owner write"
  on public.provider_profiles for all
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin())
  with check (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider kyc owner or admin read" on public.provider_kyc;
create policy "provider kyc owner or admin read"
  on public.provider_kyc for select
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider kyc owner submit" on public.provider_kyc;
create policy "provider kyc owner submit"
  on public.provider_kyc for insert
  with check (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider docs owner or admin" on public.provider_documents;
create policy "provider docs owner or admin"
  on public.provider_documents for all
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin())
  with check (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider bank owner or admin" on public.provider_bank_accounts;
create policy "provider bank owner or admin"
  on public.provider_bank_accounts for all
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin())
  with check (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider tax profile owner or admin" on public.provider_tax_profiles;
create policy "provider tax profile owner or admin"
  on public.provider_tax_profiles for all
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin())
  with check (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "tax policies admin only" on public.tax_policy_versions;
create policy "tax policies admin only"
  on public.tax_policy_versions for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tax rules admin only" on public.tax_rules;
create policy "tax rules admin only"
  on public.tax_rules for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "provider tax logs owner or admin read" on public.provider_tax_logs;
create policy "provider tax logs owner or admin read"
  on public.provider_tax_logs for select
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "withholding logs admin only" on public.withholding_logs;
create policy "withholding logs admin only"
  on public.withholding_logs for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "provider payouts owner or admin read" on public.provider_payouts;
create policy "provider payouts owner or admin read"
  on public.provider_payouts for select
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider agreements owner or admin" on public.provider_agreements;
create policy "provider agreements owner or admin"
  on public.provider_agreements for all
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin())
  with check (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider verification logs admin read" on public.provider_verification_logs;
create policy "provider verification logs admin read"
  on public.provider_verification_logs for select
  using (public.is_admin());

drop policy if exists "provider sessions owner or admin read" on public.provider_sessions;
create policy "provider sessions owner or admin read"
  on public.provider_sessions for select
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider devices owner or admin" on public.provider_devices;
create policy "provider devices owner or admin"
  on public.provider_devices for all
  using (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin())
  with check (provider_id in (select id from public.providers where user_id = auth.uid()) or public.is_admin());

-- PostgREST role grants.
-- RLS policies above still decide row-level access. HANDS business writes are
-- owned by the NestJS API, so browser/mobile Supabase roles are read-oriented.
-- New public-schema objects start private. Grant each Data API surface
-- explicitly after its RLS and ownership contract is defined.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

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
