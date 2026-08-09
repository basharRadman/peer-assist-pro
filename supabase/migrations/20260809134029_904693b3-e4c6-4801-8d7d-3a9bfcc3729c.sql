CREATE TYPE public.user_role AS ENUM ('learner','helper','both');
CREATE TYPE public.urgency_level AS ENUM ('low','normal','urgent');
CREATE TYPE public.request_status AS ENUM ('open','matched','completed');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'learner',
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  subjects TEXT[] NOT NULL DEFAULT '{}',
  avatar_url TEXT,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  urgency public.urgency_level NOT NULL DEFAULT 'normal',
  status public.request_status NOT NULL DEFAULT 'open',
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can view requests" ON public.requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Learners can create own requests" ON public.requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = learner_id);
CREATE POLICY "Learners can update own requests" ON public.requests FOR UPDATE TO authenticated USING (auth.uid() = learner_id) WITH CHECK (auth.uid() = learner_id);
CREATE POLICY "Learners can delete own requests" ON public.requests FOR DELETE TO authenticated USING (auth.uid() = learner_id);
CREATE INDEX requests_subject_idx ON public.requests (subject);
CREATE INDEX requests_created_idx ON public.requests (created_at DESC);

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests ON DELETE SET NULL,
  learner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  helper_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (learner_id, helper_id, request_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = learner_id OR auth.uid() = helper_id);
CREATE POLICY "Participants can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = learner_id OR auth.uid() = helper_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = _conversation_id AND (c.learner_id = _user_id OR c.helper_id = _user_id));
$$;
CREATE POLICY "Participants can read messages" ON public.messages FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'learner')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;