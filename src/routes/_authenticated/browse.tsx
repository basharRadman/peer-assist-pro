import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MessageSquarePlus, Search } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { SUBJECTS } from "@/lib/subjects";

type Search = { subject?: string | undefined };

export const Route = createFileRoute("/_authenticated/browse")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    subject: typeof search['subject'] === "string" ? (search['subject'] as string) : undefined,
  }),
  component: Browse,
});

const URGENCY: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive",
  normal: "bg-primary-soft text-primary",
  low: "bg-secondary text-secondary-foreground",
};

function Browse() {
  const { subject } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["requests", subject ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("requests")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(60);
      if (subject) query = query.eq("subject", subject);
      const { data: requests, error } = await query;
      if (error) throw error;

      const ids = [...new Set((requests ?? []).map((r) => r.learner_id))];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, headline").in("id", ids)
        : { data: [] };
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (requests ?? []).map((r) => ({ ...r, learner: byId.get(r.learner_id) ?? null }));
    },
  });

  const filtered = (data ?? []).filter((r) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return (
      r.title.toLowerCase().includes(term) ||
      r.topic.toLowerCase().includes(term) ||
      r.description.toLowerCase().includes(term)
    );
  });

  async function offerHelp(requestId: string, learnerId: string) {
    if (!user) return;
    if (learnerId === user.id) {
      toast.info("This is your own request.");
      return;
    }
    setPending(requestId);
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("request_id", requestId)
      .eq("helper_id", user.id)
      .maybeSingle();

    let conversationId = existing?.id;
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ request_id: requestId, learner_id: learnerId, helper_id: user.id })
        .select("id")
        .single();
      if (error) {
        setPending(null);
        toast.error(error.message);
        return;
      }
      conversationId = created.id;
    }
    setPending(null);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ to: "/messages", search: { c: conversationId } });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">
              {subject ? `${subject} requests` : "Open requests"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick something you can help with and start the conversation.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/post">Post a request</Link>
          </Button>
        </div>

        <div className="relative mt-6">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by title, topic or keyword"
            className="h-12 rounded-2xl bg-card pl-11"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/browse"
            search={{}}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              !subject ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"
            }`}
          >
            All subjects
          </Link>
          {SUBJECTS.map((s) => (
            <Link
              key={s.name}
              to="/browse"
              search={{ subject: s.name }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                subject === s.name
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-14 rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="font-semibold">No open requests here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to post one and get matched.
            </p>
            <Button asChild className="mt-5">
              <Link to="/post">Post a request</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {filtered.map((r) => (
              <li
                key={r.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{r.subject}</Badge>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${URGENCY[r.urgency]}`}
                  >
                    {r.urgency}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-semibold">{r.title}</h2>
                {r.topic && <p className="text-xs text-muted-foreground">{r.topic}</p>}
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <Link
                    to="/u/$id"
                    params={{ id: r.learner_id }}
                    className="min-w-0 truncate text-xs font-medium hover:underline"
                  >
                    {r.learner?.full_name || "Learner"}
                  </Link>
                  <Button
                    size="sm"
                    variant={r.learner_id === user?.id ? "secondary" : "default"}
                    disabled={pending === r.id}
                    onClick={() => offerHelp(r.id, r.learner_id)}
                  >
                    {pending === r.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MessageSquarePlus className="size-4" />
                    )}
                    Offer help
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
