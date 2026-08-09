import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/u/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Member profile — PeerBoost" },
      {
        name: "description",
        content: "See subjects, rating and completed help for this PeerBoost member.",
      },
      { property: "og:title", content: "Member profile — PeerBoost" },
      {
        property: "og:description",
        content: "Subjects, rating and completed help on PeerBoost.",
      },
    ],
  }),
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      const { data: requests } = await supabase
        .from("requests")
        .select("id, title, subject, status, created_at")
        .eq("learner_id", id)
        .order("created_at", { ascending: false })
        .limit(6);
      return { profile, requests: requests ?? [] };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const profile = data?.profile;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {!profile ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="font-semibold">Profile not found</p>
            <Link to="/browse" className="mt-3 inline-block text-sm text-primary hover:underline">
              Back to requests
            </Link>
          </div>
        ) : (
          <>
            <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary-soft font-display text-xl font-bold text-primary">
                {(profile.full_name || "P").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold">
                  {profile.full_name || "PeerBoost member"}
                </h1>
                <p className="truncate text-sm text-muted-foreground">
                  {profile.headline || "Member"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Star className="size-3.5 text-accent" /> {profile.rating.toFixed(1)}
                  </span>
                  <span>{profile.completed_count} completed</span>
                  <Badge variant="secondary" className="capitalize">
                    {profile.role}
                  </Badge>
                </div>
              </div>
            </header>

            {profile.bio && (
              <section className="mt-6 rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold">About</h2>
                <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                  {profile.bio}
                </p>
              </section>
            )}

            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold">Subjects</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.subjects.length ? (
                  profile.subjects.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No subjects listed yet.</p>
                )}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold">Recent requests posted</h2>
              <ul className="mt-3 space-y-2">
                {data!.requests.length ? (
                  data!.requests.map((r) => (
                    <li
                      key={r.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        <span className="block text-xs text-muted-foreground">{r.subject}</span>
                      </span>
                      <Badge variant="secondary" className="shrink-0 capitalize">
                        {r.status}
                      </Badge>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">Nothing posted yet.</li>
                )}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
