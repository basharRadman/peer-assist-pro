-- Migration: Add is_admin and suspended columns and create site_events table

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

-- Grant minimal privileges; actual access controlled via RLS
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Events / audit log for admin dashboard
CREATE TABLE IF NOT EXISTS public.site_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- e.g. 'signup', 'request.created', 'offer.created', 'order.released', 'dispute.raised', 'message.sent'
  actor_id UUID NULL REFERENCES auth.users,
  subject_id UUID NULL,
  subject_type TEXT NULL,
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_events TO anon;
GRANT ALL ON public.site_events TO service_role;

-- Enable RLS and allow select only for admins
ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins can view events" ON public.site_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin
    )
  );

-- Allow only service_role to insert events directly; authenticated inserts should go through RPCs (created below)
REVOKE INSERT ON public.site_events FROM authenticated;

-- Trigger example: if you'd like to capture specific events from existing tables consider adding triggers that INSERT into site_events from offers/orders/disputes RPCs.
