-- 1. Column-level privacy for wallet fields on profiles
REVOKE SELECT, UPDATE, INSERT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, full_name, role, headline, bio, subjects, avatar_url, rating,
  completed_count, created_at, updated_at, hourly_rate, education, portfolio_url,
  response_minutes, verified, reviews_count)
  ON public.profiles TO anon, authenticated;

GRANT INSERT (id, full_name, role, headline, bio, subjects, avatar_url, hourly_rate,
  education, portfolio_url) ON public.profiles TO authenticated;

GRANT UPDATE (full_name, role, headline, bio, subjects, avatar_url, hourly_rate,
  education, portfolio_url) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

-- 2. Secure wallet lookup (self or admin)
CREATE OR REPLACE FUNCTION public.get_wallet(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (balance numeric, escrow_held numeric, earnings numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.balance, p.escrow_held, p.earnings
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
$$;

REVOKE EXECUTE ON FUNCTION public.get_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wallet(uuid) TO authenticated;

-- 3. Raise a dispute on an order (participants only)
CREATE OR REPLACE FUNCTION public.raise_dispute(_order_id uuid, _reason text, _details text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _id uuid;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() IS NULL OR (auth.uid() <> _o.learner_id AND auth.uid() <> _o.helper_id) THEN
    RAISE EXCEPTION 'Not a participant of this order';
  END IF;
  IF _o.status NOT IN ('in_escrow', 'under_review') THEN
    RAISE EXCEPTION 'This order can no longer be disputed';
  END IF;

  INSERT INTO public.disputes (order_id, raised_by, reason, details)
  VALUES (_order_id, auth.uid(), _reason, COALESCE(_details, ''))
  RETURNING id INTO _id;

  UPDATE public.orders SET status = 'disputed', updated_at = now() WHERE id = _order_id;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.raise_dispute(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_dispute(uuid, text, text) TO authenticated;