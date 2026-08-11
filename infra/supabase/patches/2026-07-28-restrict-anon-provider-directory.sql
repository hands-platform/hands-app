-- Restrict the legacy raw Partner directory from anonymous PostgREST reads.
-- Public Partner discovery is owned by the NestJS API, which returns only the
-- reviewed public profile contract and obscures precise location data.

revoke select on table public.providers, public.provider_locations from anon;

revoke execute on function public.nearby_providers(double precision, double precision, integer)
from public, anon, authenticated;
grant execute on function public.nearby_providers(double precision, double precision, integer)
to service_role;
