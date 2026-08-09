import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

type Search = { c?: string | undefined };

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    c: typeof search['c'] === "string" ? (search['c'] as string) : undefined,
  }),
  component: Messages,
});

function Messages() {
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, request_id, learner_id, helper_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const otherIds = [
        ...new Set(rows.map((r) => (r.learner_id === user!.id ? r.helper_id : r.learner_id))),
      ];
      const reqIds = rows.map((r) => r.request_id).filter(Boolean) as string[];
      const [{ data: profiles }, { data: requests }] = await Promise.all([
        otherIds.length
          ? supabase.from("profiles").select("id, full_name, headline").in("id", otherIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string; headline: string }[] }),
        reqIds.length
          ? supabase.from("requests").select("id, title, subject").in("id", reqIds)
          : Promise.resolve({ data: [] as { id: string; title: string; subject: string }[] }),
      ]);
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const rMap = new Map((requests ?? []).map((r) => [r.id, r]));
      return rows.map((row) => ({
        ...row,
        other: pMap.get(row.learner_id === user!.id ? row.helper_id : row.learner_id) ?? null,
        request: row.request_id ? (rMap.get(row.request_id) ?? null) : null,
      }));
    },
  });

  const active = c ?? conversations?.[0]?.id;

  const { data: messages } = useQuery({
    queryKey: ["messages", active],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", active!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!active) return;
    const channel = supabase
      .channel(`messages-${active}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${active}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["messages", active] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !active || !draft.trim()) return;
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: active, sender_id: user.id, body: draft.trim() });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    queryClient.invalidateQueries({ queryKey: ["messages", active] });
  }

  async function sendFile(file: File) {
    if (!user || !active) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Files must be under 20MB");
      return;
    }
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase.from("messages").insert({
      conversation_id: active,
      sender_id: user.id,
      body: "",
      file_url: path,
      file_name: file.name,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["messages", active] });
  }

  async function download(path: string) {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Could not open that file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const activeConversation = conversations?.find((cv) => cv.id === active);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Messages</h1>

        {isLoading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (conversations?.length ?? 0) === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="font-semibold">No conversations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Offer help on a request to start chatting.
            </p>
            <Button asChild className="mt-5">
              <Link to="/browse">Browse requests</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <ul className="max-h-[30vh] space-y-2 overflow-y-auto lg:max-h-[70vh]">
              {conversations!.map((cv) => (
                <li key={cv.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/messages", search: { c: cv.id } })}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      cv.id === active
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold">
                      {cv.other?.full_name || "PeerBoost user"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {cv.request?.title ?? "Direct message"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            <section className="flex h-[70vh] flex-col rounded-2xl border border-border bg-card">
              <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {activeConversation?.other?.full_name || "Conversation"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {activeConversation?.request?.subject ?? "Direct message"}
                  </p>
                </div>
                {activeConversation?.other && (
                  <Button asChild size="sm" variant="secondary" className="shrink-0">
                    <Link to="/u/$id" params={{ id: activeConversation.other.id }}>
                      View profile
                    </Link>
                  </Button>
                )}
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {(messages ?? []).map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                        {m.file_url && (
                          <button
                            type="button"
                            onClick={() => download(m.file_url!)}
                            className="mt-1 inline-flex items-center gap-2 text-xs font-medium underline underline-offset-2"
                          >
                            <Download className="size-3.5" />
                            {m.file_name ?? "Attachment"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
                <label
                  htmlFor="chat-file"
                  className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-border text-muted-foreground hover:bg-secondary"
                  aria-label="Attach a file"
                >
                  <Paperclip className="size-4" />
                </label>
                <input
                  id="chat-file"
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void sendFile(f);
                    e.target.value = "";
                  }}
                />
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  maxLength={2000}
                  className="h-10"
                />
                <Button type="submit" size="icon" className="size-10 shrink-0" disabled={sending}>
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
