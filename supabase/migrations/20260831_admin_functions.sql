-- Migration: admin RPCs (set_user_admin, suspend_user, insert_site_event)

-- Helper: insert event (security definer)
CREATE OR REPLACE FUNCTION public.insert_site_event(_type text, _actor uuid, _subject uuid, _subject_type text, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.site_events(type, actor_id, subject_id, subject_type, payload)
  VALUES (_type, _actor, _subject, _subject_type, _payload);
END;
$$;
REVOKE ALL ON FUNCTION public.insert_site_event(text, uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_site_event(text, uuid, uuid, text, jsonb) TO service_role;

-- RPC to set user's admin flag
CREATE OR REPLACE FUNCTION public.set_user_admin(_user_id uuid, _is_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only allow existing admins (or service_role) to call: check caller profile
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin) THEN
    RAISE EXCEPTION 'only admins may call set_user_admin';
  END IF;
  UPDATE public.profiles SET is_admin = _is_admin WHERE id = _user_id;
  PERFORM public.insert_site_event('admin.set_user_admin', auth.uid()::uuid, _user_id, 'profile', jsonb_build_object('is_admin', _is_admin));
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_admin(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_admin(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_admin(uuid, boolean) TO authenticated;

-- RPC to suspend or unsuspend a user
CREATE OR REPLACE FUNCTION public.set_user_suspended(_user_id uuid, _suspended boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin) THEN
    RAISE EXCEPTION 'only admins may call set_user_suspended';
  END IF;
  UPDATE public.profiles SET suspended = _suspended WHERE id = _user_id;
  PERFORM public.insert_site_event('admin.set_user_suspended', auth.uid()::uuid, _user_id, 'profile', jsonb_build_object('suspended', _suspended));
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_suspended(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean) TO authenticated;

-- RPC to resolve disputes (example assuming disputes table exists)
CREATE OR REPLACE FUNCTION public.resolve_dispute(_dispute_id uuid, _resolution_note text, _new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _order_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin) THEN
    RAISE EXCEPTION 'only admins may call resolve_dispute';
  END IF;
  UPDATE public.disputes SET status = _new_status, resolution_note = _resolution_note, updated_at = now() WHERE id = _dispute_id RETURNING order_id INTO _order_id;
  PERFORM public.insert_site_event('admin.resolve_dispute', auth.uid()::uuid, _dispute_id, 'dispute', jsonb_build_object('status', _new_status, 'note', _resolution_note));
  -- Optionally call existing escrow RPCs here to release/refund based on _new_status
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text) TO authenticated;
