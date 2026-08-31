### Pull Request: feat(admin): admin dashboard, activity tab and event logging

This PR adds an admin dashboard, an activity tab on the profile, and event logging for key actions.

Summary
- Admin dashboard route (/_authenticated/admin) to manage users and view site events.
- Adds site_events audit table and RLS so admins can view an events feed.
- Adds admin RPCs (set_user_admin, set_user_suspended, resolve_dispute) and insert_site_event helper.
- Integrates events into server-side functions (offer accepted, order released, order refunded, dispute raised).
- Adds Activity tab to authenticated profile page to surface recent site_events relevant to the user.

DB Migration files are in supabase/migrations — run them before testing.

Testing steps
1. Apply migrations to your Supabase database.
2. Mark a user as admin (UPDATE public.profiles SET is_admin = true WHERE id = '<uuid>') to access /_authenticated/admin.
3. Use the admin page to view events and manage users.
4. Accept offers, release escrow, raise disputes and ensure events appear in the admin events list and activity tab.

Notes
- RPCs are SECURITY DEFINER and check for admin role before running admin actions.
- Event inserts are performed from within the server-side functions for consistency.
