import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Loader2, Paperclip, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

type Search = { c?: string | undefined };

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages · PeerBoost" },
      {
        name: "description",
        content: "Chat privately with every learner or helper you work with on PeerBoost.",
      },
      { property: "og:title", content: "Messages · PeerBoost" },
      { property: "og:description", content: "One private conversation per person, in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    c: typeof search['c'] === "string" ? (search['c'] as string) : undefined,
  }),
  component: Messages,
});

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

function chatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

function Messages() {
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [term, setTerm] = useState("");
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
      const convIds = rows.map((r) => r.id);
      const [{ data: profiles }, { data: requests }, { data: recent }] = await Promise.all([
        otherIds.length
          ? supabase.from("profiles").select("id, full_name, headline").in("id", otherIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string; headline: string }[] }),
        reqIds.length
          ? supabase.from("requests").select("id, title, subject").in("id", reqIds)
          : Promise.resolve({ data: [] as { id: string; title: string; subject: string }[] }),
        convIds.length
          ? supabase
              .from("messages")
              .select("conversation_id, body, file_name, created_at, sender_id")
              .in("conversation_id", convIds)
              .order("created_at", { ascending: false })
              .limit(400)
          : Promise.resolve({
              data: [] as {
                conversation_id: string;
                body: string;
                file_name: string | null;
                created_at: string;
                sender_id: string;
              }[],
            }),
      ]);
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const rMap = new Map((requests ?? []).map((r) => [r.id, r]));
      const lastMap = new Map<string, (typeof recent)[number]>();
      for (const m of recent ?? []) if (!lastMap.has(m.conversation_id)) lastMap.set(m.conversation_id, m);

      return rows
        .map((row) => ({
          ...row,
          other: pMap.get(row.learner_id === user!.id ? row.helper_id : row.learner_id) ?? null,
          request: row.request_id ? (rMap.get(row.request_id) ?? null) : null,
          last: lastMap.get(row.id) ?? null,
        }))
        .sort(
          (a, b) =>
            +new Date(b.last?.created_at ?? b.created_at) -
            +new Date(a.last?.created_at ?? a.created_at),
        );
    },
  });

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return conversations ?? [];
    return (conversations ?? []).filter(
      (cv) =>
        (cv.other?.full_name ?? "").toLowerCase().includes(q) ||
        (cv.request?.title ?? "").toLowerCase().includes(q),
    );
  }, [conversations, term]);

  const active = c;

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
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", active] });
          queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, queryClient, user?.id]);

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
    queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
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
    queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
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
          <div className="mt-5 grid h-[calc(100dvh-190px)] min-h-[520px] overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* Conversation list */}
            <aside
              className={`flex min-h-0 flex-col border-border lg:border-r ${
                active ? "hidden lg:flex" : "flex"
              }`}
            >
              <div className="border-b border-border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Search chats"
                    className="h-10 pl-9"
                  />
                </div>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {filtered.map((cv) => {
                  const name = cv.other?.full_name || "PeerBoost user";
                  const preview = cv.last
                    ? `${cv.last.sender_id === user?.id ? "You: " : ""}${
                        cv.last.body || cv.last.file_name || "Attachment"
                      }`
                    : cv.request?.title
                      ? `About: ${cv.request.title}`
                      : "Say hello 👋";
                  return (
                    <li key={cv.id}>
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/messages", search: { c: cv.id } })}
                        className={`flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-secondary/70 ${
                          cv.id === active ? "bg-secondary" : ""
                        }`}
                      >
                        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                          {initials(name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {chatTime(cv.last?.created_at ?? cv.created_at)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {preview}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="p-6 text-center text-sm text-muted-foreground">No chats found</li>
                )}
              </ul>
            </aside>

            {/* Chat pane */}
            <section
              className={`min-h-0 flex-col ${active ? "flex" : "hidden lg:flex"}`}
            >
              {!active ? (
                <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">
                  Select a conversation to start chatting.
                </div>
              ) : (
                <>
                  <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label="Back to chats"
                      onClick={() => navigate({ to: "/messages", search: {} })}
                    >
                      <ArrowLeft className="size-5" />
                    </Button>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                      {initials(activeConversation?.other?.full_name || "?")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {activeConversation?.other?.full_name || "Conversation"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeConversation?.request?.title ?? "Direct message"}
                      </p>
                    </div>
                    {activeConversation?.other && (
                      <Button asChild size="sm" variant="secondary" className="shrink-0">
                        <Link to="/u/$id" params={{ id: activeConversation.other.id }}>
                          Profile
                        </Link>
                      </Button>
                    )}
                  </header>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-secondary/30 px-4 py-4">
                    {(messages ?? []).map((m, i) => {
                      const mine = m.sender_id === user?.id;
                      const prev = (messages ?? [])[i - 1];
                      const newDay =
                        !prev ||
                        new Date(prev.created_at).toDateString() !==
                          new Date(m.created_at).toDateString();
                      return (
                        <div key={m.id}>
                          {newDay && (
                            <div className="my-3 flex justify-center">
                              <span className="rounded-full bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                                {dayLabel(m.created_at)}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                                mine
                                  ? "rounded-br-sm bg-primary text-primary-foreground"
                                  : "rounded-bl-sm bg-card text-foreground"
                              }`}
                            >
                              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
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
                              <span
                                className={`mt-1 block text-right text-[10px] ${
                                  mine ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}
                              >
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  <form
                    onSubmit={send}
                    className="flex items-center gap-2 border-t border-border p-3"
                  >
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
                      placeholder="Type a message"
                      maxLength={2000}
                      className="h-10 rounded-full"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="size-10 shrink-0 rounded-full"
                      disabled={sending}
                    >
                      {sending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
