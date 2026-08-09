-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PROFILE EXTRAS + WALLET
ALTER TABLE public.profiles
  ADD COLUMN hourly_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN education text NOT NULL DEFAULT '',
  ADD COLUMN portfolio_url text NOT NULL DEFAULT '',
  ADD COLUMN response_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN verified boolean NOT NULL DEFAULT false,
  ADD COLUMN reviews_count integer NOT NULL DEFAULT 0,
  ADD COLUMN balance numeric NOT NULL DEFAULT 500,
  ADD COLUMN escrow_held numeric NOT NULL DEFAULT 0,
  ADD COLUMN earnings numeric NOT NULL DEFAULT 0;

CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- REQUESTS: budget + admin control
ALTER TABLE public.requests
  ADD COLUMN budget numeric NOT NULL DEFAULT 0,
  ADD COLUMN deadline date;

CREATE POLICY "Admins manage requests" ON public.requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- OFFERS
CREATE TYPE public.offer_status AS ENUM ('pending','accepted','declined','withdrawn');
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  message text NOT NULL DEFAULT '',
  status public.offer_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users view offers" ON public.offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Helpers create own offers" ON public.offers FOR INSERT TO authenticated WITH CHECK (helper_id = auth.uid());
CREATE POLICY "Helpers update own offers" ON public.offers FOR UPDATE TO authenticated USING (helper_id = auth.uid()) WITH CHECK (helper_id = auth.uid());
CREATE POLICY "Admins manage offers" ON public.offers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORDERS
CREATE TYPE public.order_status AS ENUM ('in_escrow','under_review','completed','refunded','disputed','cancelled');
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  title text NOT NULL DEFAULT '',
  status public.order_status NOT NULL DEFAULT 'in_escrow',
  delivery_note text NOT NULL DEFAULT '',
  delivery_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view orders" ON public.orders FOR SELECT TO authenticated
  USING (learner_id = auth.uid() OR helper_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Helpers update delivery" ON public.orders FOR UPDATE TO authenticated
  USING (helper_id = auth.uid()) WITH CHECK (helper_id = auth.uid());
CREATE POLICY "Admins manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  kind text NOT NULL,
  amount numeric NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage transactions" ON public.transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- DISPUTES
CREATE TYPE public.dispute_status AS ENUM ('open','resolved_released','resolved_refunded','rejected');
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status public.dispute_status NOT NULL DEFAULT 'open',
  resolution_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view disputes" ON public.disputes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.learner_id = auth.uid() OR o.helper_id = auth.uid())));
CREATE POLICY "Participants raise disputes" ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.learner_id = auth.uid() OR o.helper_id = auth.uid())));
CREATE POLICY "Admins manage disputes" ON public.disputes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER disputes_updated_at BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REVIEWS
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are public" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Learners create reviews" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.learner_id = auth.uid() AND o.status = 'completed'));
CREATE POLICY "Admins manage reviews" ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- CONVERSATIONS/MESSAGES: admin oversight
CREATE POLICY "Admins manage conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage messages" ON public.messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ESCROW OPERATIONS
CREATE OR REPLACE FUNCTION public.accept_offer(_offer_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record; _r record; _uid uuid := auth.uid(); _order_id uuid; _bal numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _o FROM public.offers WHERE id = _offer_id AND status = 'pending';
  IF _o IS NULL THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
  SELECT * INTO _r FROM public.requests WHERE id = _o.request_id;
  IF _r.learner_id <> _uid THEN RAISE EXCEPTION 'Only the learner can accept this offer'; END IF;
  SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal < _o.amount THEN RAISE EXCEPTION 'Insufficient balance — add funds to your wallet'; END IF;

  UPDATE public.profiles SET balance = balance - _o.amount, escrow_held = escrow_held + _o.amount WHERE id = _uid;
  UPDATE public.offers SET status = 'accepted' WHERE id = _offer_id;
  UPDATE public.offers SET status = 'declined' WHERE request_id = _o.request_id AND id <> _offer_id AND status = 'pending';
  UPDATE public.requests SET status = 'matched' WHERE id = _o.request_id;

  INSERT INTO public.orders (request_id, offer_id, learner_id, helper_id, amount, title)
  VALUES (_o.request_id, _o.id, _uid, _o.helper_id, _o.amount, _r.title) RETURNING id INTO _order_id;

  INSERT INTO public.transactions (user_id, order_id, kind, amount, note)
  VALUES (_uid, _order_id, 'escrow_hold', -_o.amount, 'Funds locked in escrow');

  INSERT INTO public.conversations (request_id, learner_id, helper_id)
  SELECT _o.request_id, _uid, _o.helper_id
  WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.learner_id = _uid AND c.helper_id = _o.helper_id AND c.request_id IS NOT DISTINCT FROM _o.request_id);

  RETURN _order_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_escrow(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record; _uid uuid := auth.uid(); _admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _admin := public.has_role(_uid,'admin');
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _o IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT _admin AND _o.learner_id <> _uid THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _o.status NOT IN ('in_escrow','under_review','disputed') THEN RAISE EXCEPTION 'Order already settled'; END IF;

  UPDATE public.profiles SET escrow_held = GREATEST(escrow_held - _o.amount, 0) WHERE id = _o.learner_id;
  UPDATE public.profiles SET balance = balance + _o.amount, earnings = earnings + _o.amount, completed_count = completed_count + 1 WHERE id = _o.helper_id;
  UPDATE public.orders SET status = 'completed' WHERE id = _order_id;
  UPDATE public.requests SET status = 'completed' WHERE id = _o.request_id;
  UPDATE public.disputes SET status = 'resolved_released' WHERE order_id = _order_id AND status = 'open';
  INSERT INTO public.transactions (user_id, order_id, kind, amount, note)
  VALUES (_o.helper_id, _order_id, 'escrow_release', _o.amount, 'Escrow released'),
         (_o.learner_id, _order_id, 'escrow_settled', 0, 'Escrow released to helper');
END; $$;
REVOKE EXECUTE ON FUNCTION public.release_escrow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_escrow(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.refund_escrow(_order_id uuid, _note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _o IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.status IN ('completed','refunded') THEN RAISE EXCEPTION 'Order already settled'; END IF;
  UPDATE public.profiles SET escrow_held = GREATEST(escrow_held - _o.amount, 0), balance = balance + _o.amount WHERE id = _o.learner_id;
  UPDATE public.orders SET status = 'refunded' WHERE id = _order_id;
  UPDATE public.disputes SET status = 'resolved_refunded', resolution_note = COALESCE(NULLIF(_note,''), resolution_note) WHERE order_id = _order_id AND status = 'open';
  INSERT INTO public.transactions (user_id, order_id, kind, amount, note)
  VALUES (_o.learner_id, _order_id, 'refund', _o.amount, COALESCE(NULLIF(_note,''),'Escrow refunded'));
END; $$;
REVOKE EXECUTE ON FUNCTION public.refund_escrow(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_escrow(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_demo_funds(_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 OR _amount > 5000 THEN RAISE EXCEPTION 'Amount must be between 1 and 5000'; END IF;
  UPDATE public.profiles SET balance = balance + _amount WHERE id = _uid RETURNING balance INTO _new;
  INSERT INTO public.transactions (user_id, kind, amount, note) VALUES (_uid,'topup',_amount,'Demo funds added');
  RETURN _new;
END; $$;
REVOKE EXECUTE ON FUNCTION public.add_demo_funds(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_demo_funds(numeric) TO authenticated;

-- review aggregation
CREATE OR REPLACE FUNCTION public.apply_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles p SET
    reviews_count = p.reviews_count + 1,
    rating = ROUND(((p.rating * p.reviews_count) + NEW.rating) / (p.reviews_count + 1), 2)
  WHERE p.id = NEW.helper_id;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.apply_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reviews_apply AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.apply_review();

-- first signed-up user helper: grant admin by email
CREATE OR REPLACE FUNCTION public.grant_admin_by_email(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT id INTO _id FROM auth.users WHERE lower(email) = lower(_email);
  IF _id IS NULL THEN RAISE EXCEPTION 'No user with that email'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_id,'admin') ON CONFLICT DO NOTHING;
END; $$;
REVOKE EXECUTE ON FUNCTION public.grant_admin_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_admin_by_email(text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;