CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = _conversation_id AND (c.learner_id = _user_id OR c.helper_id = _user_id));
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;