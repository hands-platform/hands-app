-- HANDS Supabase patch: make future public-schema Data API exposure opt-in.
-- Apply once to existing projects. This does not revoke the explicit grants
-- already assigned to current tables and functions.

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
