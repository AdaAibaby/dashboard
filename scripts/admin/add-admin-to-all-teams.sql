-- Grant an admin user membership in EVERY team.
--
-- Why: the dashboard's "All teams · Sandboxes" admin view aggregates sandboxes
-- via getAllTeamsSandboxes -> listUserTeams(), which only returns teams the
-- caller belongs to. To see every team, the admin must be a member of all of
-- them (mirrors the original admin design).
--
-- The admin is identified by user_id (public.users.id / Ory external_id) — the
-- same id you put in the ADMIN_USER_IDS env var. This id is ENVIRONMENT-SPECIFIC
-- (dev/prod differ), so this is NOT an automatic migration: run it once per
-- environment with that environment's admin user_id.
--
-- Usage:
--   psql "$POSTGRES_URL" \
--     -v admin_user_id="00000000-0000-0000-0000-000000000000" \
--     -f scripts/admin/add-admin-to-all-teams.sql
--
-- Idempotent: re-running only inserts the (user, team) rows that are missing.
-- is_default defaults to false, so it never changes the admin's own default team.

INSERT INTO public.users_teams (user_id, team_id)
SELECT :'admin_user_id', t.id
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users_teams ut
  WHERE ut.user_id = :'admin_user_id'
    AND ut.team_id = t.id
);
