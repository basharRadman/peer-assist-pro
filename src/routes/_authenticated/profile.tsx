import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { SUBJECTS } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type Role = "learner" | "helper" | "both";

function ProfilePage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState<Role>("learner");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setHeadline(profile.headline ?? "");
    setBio(profile.bio ?? "");
    setRole(profile.role);
    setSubjects(profile.subjects ?? []);
  }, [profile]);

  function toggleSubject(name: string) {
    setSubjects((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim().slice(0, 80),
        headline: headline.trim().slice(0, 120),
        bio: bio.trim().slice(0, 1000),
        role,
        subjects,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Profile updated");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Helpers with detailed subjects get matched far more often.
        </p>

        {isLoading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form
            onSubmit={save}
            className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full name</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  maxLength={120}
                  placeholder="CS undergrad · Python & algorithms"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">About</Label>
              <Textarea
                id="bio"
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={1000}
                placeholder="What can you help with, and how do you like to work?"
              />
            </div>

            <div className="space-y-2">
              <Label>I am a</Label>
              <div className="flex flex-wrap gap-2">
                {(["learner", "helper", "both"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      role === r
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subjects I can help with</Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => toggleSubject(s.name)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                      subjects.includes(s.name)
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-xl bg-secondary/60 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="font-display text-lg font-bold">
                  {profile?.rating?.toFixed(1) ?? "0.0"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed help</p>
                <p className="font-display text-lg font-bold">{profile?.completed_count ?? 0}</p>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save profile
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
