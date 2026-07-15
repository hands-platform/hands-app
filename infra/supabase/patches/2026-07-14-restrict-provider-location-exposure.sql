-- Restrict exact Partner location data to the NestJS server and the owning
-- Partner. Apply once to Supabase projects created before 2026-07-14.

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

revoke select on public.provider_locations from anon;
revoke execute on function public.nearby_providers(double precision, double precision, integer)
from public, anon, authenticated;
grant execute on function public.nearby_providers(double precision, double precision, integer)
to service_role;
