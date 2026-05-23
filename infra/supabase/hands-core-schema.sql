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
  create type public.payment_method as enum ('MOMO', 'VNPAY', 'CASH');
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
  rating numeric(3, 2) not null default 0,
  review_count integer not null default 0,
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
  scheduled_at timestamptz not null default now(),
  expires_at timestamptz,
  subtotal_vnd integer not null default 0,
  total_vnd integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  rating integer not null check (rating between 1 and 5),
  body text,
  tip_amount_vnd integer not null default 0,
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
  tip_amount_vnd integer not null default 0 check (tip_amount_vnd >= 0),
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
  token text not null unique,
  platform text not null,
  enabled boolean not null default true,
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
create index if not exists provider_verifications_status_idx on public.provider_verifications(status);
create index if not exists provider_locations_location_idx on public.provider_locations using gist(location);
create index if not exists provider_locations_updated_idx on public.provider_locations(updated_at desc);
create index if not exists customer_selected_locations_customer_idx
  on public.customer_selected_locations(customer_id, created_at desc);
create index if not exists bookings_customer_idx on public.bookings(customer_id, created_at desc);
create index if not exists bookings_selected_provider_idx on public.bookings(selected_provider_id, created_at desc);
create index if not exists bookings_status_idx on public.bookings(status, created_at desc);
create index if not exists booking_participants_provider_idx
  on public.booking_participants(provider_id, created_at desc);
create index if not exists messages_room_idx on public.messages(chat_room_id, created_at desc);
create index if not exists provider_earnings_provider_idx on public.provider_earnings(provider_id, created_at desc);
create index if not exists provider_earnings_status_idx on public.provider_earnings(status, created_at desc);
create index if not exists provider_payout_batches_provider_idx on public.provider_payout_batches(provider_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists push_devices_user_idx on public.push_devices(user_id, created_at desc);
create index if not exists notification_deliveries_notification_idx
  on public.notification_deliveries(notification_id, attempted_at desc);
create index if not exists files_owner_idx on public.files(owner_id, created_at desc);
create index if not exists files_owner_purpose_idx on public.files(owner_id, purpose, created_at desc);
create index if not exists files_visibility_purpose_idx on public.files(visibility, purpose, created_at desc);
create index if not exists location_snapshots_provider_idx on public.location_snapshots(provider_id, recorded_at desc);
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
create policy "recent provider locations read"
  on public.provider_locations for select
  using (updated_at >= now() - interval '24 hours' or public.is_admin());

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

-- PostgREST role grants.
-- RLS policies above still decide row-level access; these grants only allow
-- Supabase API roles to reach the tables/functions protected by those policies.
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
