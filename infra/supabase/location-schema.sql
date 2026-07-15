-- HANDS low-cost location schema for Supabase.
-- Uses PostGIS for fast radius searches. Run in Supabase SQL editor.

create extension if not exists postgis;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'massage',
  status text not null default 'OFFLINE',
  created_at timestamptz not null default now()
);

create table if not exists public.provider_locations (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography(point, 4326)
    generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  updated_at timestamptz not null default now()
);

create index if not exists provider_locations_location_idx
  on public.provider_locations using gist (location);

create index if not exists provider_locations_updated_at_idx
  on public.provider_locations (updated_at desc);

create table if not exists public.customer_selected_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_selected_locations_customer_created_idx
  on public.customer_selected_locations (customer_id, created_at desc);

create or replace function public.nearby_providers(
  input_lat double precision,
  input_lng double precision,
  radius_meters integer default 5000
)
returns table (
  provider_id uuid,
  name text,
  category text,
  status text,
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
    p.id as provider_id,
    p.name,
    p.category,
    p.status,
    pl.latitude,
    pl.longitude,
    pl.updated_at,
    round(st_distance(pl.location, origin.point) / 100.0)::integer * 100 as distance_meters,
    pl.updated_at >= now() - interval '30 minutes' as is_recent_location
  from public.providers p
  join public.provider_locations pl on pl.provider_id = p.id
  cross join origin
  where p.status in ('ONLINE_AVAILABLE', 'ONLINE_AVAILABLE_SOON')
    and pl.updated_at >= now() - interval '24 hours'
    and st_dwithin(pl.location, origin.point, radius_meters)
  order by st_distance(pl.location, origin.point), p.status;
$$;

alter table public.providers enable row level security;
alter table public.provider_locations enable row level security;
alter table public.customer_selected_locations enable row level security;

-- Legacy draft safety: public provider metadata may be visible, but exact
-- locations and the radius RPC remain server-only. The generated staging pack
-- uses hands-core-schema.sql instead of this file.
create policy if not exists "public read active providers"
  on public.providers for select
  using (true);

drop policy if exists "public read provider locations" on public.provider_locations;
revoke select on public.provider_locations from anon;
revoke execute on function public.nearby_providers(double precision, double precision, integer)
from public, anon, authenticated;
grant execute on function public.nearby_providers(double precision, double precision, integer)
to service_role;
