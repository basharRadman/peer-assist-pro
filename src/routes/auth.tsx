import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in or join — PeerBoost" },
      {
        name: "description",
        content: "Create a PeerBoost account as a learner, a helper, or both.",
      },
      { property: "og:title", content: "Join PeerBoost" },
      {
        property: "og:description",
        content: "Sign up to post requests or help peers with their assignments.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("learner");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/browse", replace: true });
  }, [session, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/browse" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setSent(true);
      return;
    }
    navigate({ to: "/profile" });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/browse" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="surface-ink hidden flex-col justify-between p-12 lg:flex">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          PeerBoost
        </Link>
        <div>
          <h2 className="max-w-sm text-3xl font-bold text-balance">
            Someone out there has already solved the thing you're stuck on.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-ink-foreground/70">
            Join as a learner, a helper, or both — switch roles any time from your profile.
          </p>
        </div>
        <p className="text-xs text-ink-foreground/50">Learn together, finish faster.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold">Welcome to PeerBoost</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Post requests, offer help, and chat with your match.
          </p>

          {sent ? (
            <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm">
              <p className="font-semibold">Check your email</p>
              <p className="mt-1 text-muted-foreground">
                We sent a confirmation link to {email}. Click it to activate your account.
              </p>
            </div>
          ) : (
            <Tabs defaultValue="signup" className="mt-8">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="login">Log in</TabsTrigger>
              </TabsList>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={80}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>I want to join as</Label>
                    <RadioGroup value={role} onValueChange={setRole} className="grid grid-cols-3">
                      {[
                        { v: "learner", l: "Learner" },
                        { v: "helper", l: "Helper" },
                        { v: "both", l: "Both" },
                      ].map((o) => (
                        <Label
                          key={o.v}
                          htmlFor={`role-${o.v}`}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-2.5 text-xs font-medium has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                        >
                          <RadioGroupItem id={`role-${o.v}`} value={o.v} className="sr-only" />
                          {o.l}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />} Create account
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="login">
                <form onSubmit={signIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-in">Email</Label>
                    <Input
                      id="email-in"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-in">Password</Label>
                    <Input
                      id="password-in"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />} Log in
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="secondary" className="w-full" onClick={google}>
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
