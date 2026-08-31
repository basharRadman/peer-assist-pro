import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  FileText,
  Loader2,
  MessageSquare,
  Star,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { SUBJECTS } from "@/lib/subjects";
import { money, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My account · PeerBoost" },
      {
        name: "description",
        content:
          "Manage your PeerBoost profile, notifications, requests and projects from one account hub.",
      },
      { property: "og:title", content: "My account · PeerBoost" },
      {
        property: "og:description",
        content: "Profile details, notifications, requests and active projects in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type Role = "learner" | "helper" | "both";

const SEEN_KEY = "pb:notifications-seen";

function ProfilePage() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [education, setEducation] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [role, setRole] = useState<Role>("learner");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(0);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(SEEN_KEY) : null;
    setSeenAt(raw ? Number(raw) : 0);
  }, []);

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

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_wallet", { _user_id: user!.id });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, offers(id, amount, status, helper_id, created_at)")
        .eq("learner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or(`learner_id.eq.${user!.id},helper_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myOffers } = useQuery({
    queryKey: ["my-offers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*, requests(id, title, subject, budget)")
        .eq("helper_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["my-reviews", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("helper_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Activity: fetch site_events related to the user (actor or subject)
  const { data: activity } = useQuery({
    queryKey: ["activity", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // get events where actor_id = user OR subject_id = user
      const { data, error } = await supabase
        .from("site_events")
        .select("*")
        .or(`actor_id.eq.${user!.id},subject_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Transactions history
  const { data: transactions } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setHeadline(profile.headline ?? "");
    setBio(profile.bio ?? "");
    setEducation(profile.education ?? "");
    setPortfolio(profile.portfolio_url ?? "");
    setHourlyRate(String(profile.hourly_rate ?? 0));
    setRole(profile.role);
    setSubjects(profile.subjects ?? []);
  }, [profile]);

  const notifications = useMemo(() => {
    const items: { id: string; at: string; title: string; body: string; to?: string }[] = [];
    for (const r of requests ?? []) {
      for (const o of (r as unknown as { offers: { id: string; amount: number; status: string; created_at: string }[] })
        .offers ?? []) {
        items.push({
          id: `offer-${o.id}`,
          at: o.created_at,
          title: `New offer on “${r.title}”`,
          body: `${money(o.amount)} · offer ${o.status}`,
        });
      }
    }
    for (const o of orders ?? []) {
      items.push({
        id: `order-${o.id}-${o.updated_at}`,
        at: o.updated_at,
        title: `Project “${o.title || "Untitled"}” is ${o.status.replace(/_/g, " ")}`,
        body: `${money(o.amount)} ${o.learner_id === user?.id ? "held from your wallet" : "waiting for release"}`,
      });
    }
    for (const o of myOffers ?? []) {
      if (o.status === "accepted" || o.status === "declined") {
        items.push({
          id: `myoffer-${o.id}`,
          at: o.updated_at,
          title: `Your offer was ${o.status}`,
          body: `${(o as unknown as { requests: { title: string } | null }).requests?.title ?? "Request"} · ${money(o.amount)}`,
        });
      }
    }
    for (const rv of reviews ?? []) {
      items.push({
        id: `review-${rv.id}`,
        at: rv.created_at,
        title: `You received a ${rv.rating}★ review`,
        body: rv.comment || "No comment left",
      });
    }
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 40);
  }, [requests, orders, myOffers, reviews, user?.id]);

  const unread = notifications.filter((n) => +new Date(n.at) > seenAt).length;

  function markSeen() {
    const now = Date.now();
    window.localStorage.setItem(SEEN_KEY, String(now));
    setSeenAt(now);
  }

  function toggleSubject(name: string) {
    setSubjects((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
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
        education: education.trim().slice(0, 200),
        portfolio_url: portfolio.trim().slice(0, 300),
        hourly_rate: Math.max(0, Math.min(1000, Number(hourlyRate) || 0)),
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

  const asLearner = (orders ?? []).filter((o) => o.learner_id === user?.id);
  const asHelper = (orders ?? []).filter((o) => o.helper_id === user?.id);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">My account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything about your PeerBoost account, organised in tabs.
            </p>
          </div>
          {user && (
            <Button asChild variant="secondary">
              <Link to="/u/$id" params={{ id: user.id }}>
                View public profile
              </Link>
            </Button>
          )}
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <StatCard label="Available" value={money(wallet?.balance ?? 0)} />
          <StatCard label="In escrow" value={money(wallet?.escrow_held ?? 0)} />
          <StatCard label="Earnings" value={money(wallet?.earnings ?? 0)} />
          <StatCard
            label="Rating"
            value={`${(profile?.rating ?? 0).toFixed(1)} (${profile?.reviews_count ?? 0})`}
          />
        </div>

        {isLoading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="profile" className="mt-8">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="profile" className="gap-2">
                <UserRound className="size-4" /> Profile
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2" onClick={markSeen}>
                <Bell className="size-4" /> Notifications
                {unread > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {unread}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="requests" className="gap-2">
                <FileText className="size-4" /> My requests
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2">
                <BriefcaseBusiness className="size-4" /> Projects
              </TabsTrigger>
              <TabsTrigger value="reviews" className="gap-2">
                <Star className="size-4" /> Reviews
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2">
                <MessageSquare className="size-4" /> Activity
              </TabsTrigger>
+              <TabsTrigger value="transactions" className="gap-2">
+                <DollarSign className="size-4" /> Transactions
+              </TabsTrigger>
            </TabsList>

            {/* ---------------- Profile ---------------- */}
            <TabsContent value="profile" className="mt-6">
              <form
                onSubmit={save}
                className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card"
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
                  <div className="space-y-2">
                    <Label htmlFor="education">Education</Label>
                    <Input
                      id="education"
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      maxLength={200}
                      placeholder="BSc Computer Science, Sana'a University"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate">Hourly rate (USD)</Label>
                    <Input
                      id="rate"
                      type="number"
                      min={0}
                      max={1000}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portfolio">Portfolio link</Label>
                  <Input
                    id="portfolio"
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    placeholder="https://github.com/username"
                  />
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

                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />} Save changes
                </Button>
              </form>
            </TabsContent>

            {/* ---------------- Notifications ---------------- */}
            <TabsContent value="notifications" className="mt-6">
              {notifications.length === 0 ? (
                <Empty text="No notifications yet. Activity on your requests and projects shows up here." />
              ) : (
                <ul className="space-y-2">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-2xl border border-border bg-card p-4 shadow-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{n.title}</p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.body}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* ---------------- Requests ---------------- */}
            <TabsContent value="requests" className="mt-6 space-y-3">
              {(requests?.length ?? 0) === 0 ? (
                <Empty text="You haven't posted any requests yet.">
                  <Button asChild className="mt-4">
                    <Link to="/post">Post a request</Link>
                  </Button>
                </Empty>
              ) : (
                requests!.map((r) => {
                  const offers =
                    (r as unknown as { offers: { id: string; status: string }[] }).offers ?? [];
                  return (
                    <article
                      key={r.id}
                      className="rounded-2xl border border-border bg-card p-5 shadow-card"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold">{r.title}</h3>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold capitalize">
                          {r.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {r.subject} · budget {money(r.budget)} · {timeAgo(r.created_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{offers.length} offer(s)</span>
                        <Button asChild size="sm" variant="secondary">
                          <Link to="/dashboard">Manage offers</Link>
                        </Button>
                      </div>
                    </article>
                  );
                })
              )}
            </TabsContent>

            {/* ---------------- Projects ---------------- */}
            <TabsContent value="projects" className="mt-6 space-y-6">
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Projects I requested
                </h2>
                <div className="mt-3 space-y-3">
                  {asLearner.length === 0 ? (
                    <Empty text="No escrowed projects as a learner yet." />
                  ) : (
                    asLearner.map((o) => <OrderCard key={o.id} order={o} side="learner" />)
                  )}
                </div>
              </section>
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground">Projects I deliver</h2>
                <div className="mt-3 space-y-3">
                  {asHelper.length === 0 ? (
                    <Empty text="No jobs accepted as a helper yet." />
                  ) : (
                    asHelper.map((o) => <OrderCard key={o.id} order={o} side="helper" />)
                  )}
                </div>
              </section>
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground">Offers I sent</h2>
                <div className="mt-3 space-y-2">
                  {(myOffers?.length ?? 0) === 0 ? (
                    <Empty text="You haven't sent any offers yet." />
                  ) : (
                    myOffers!.map((o) => (
                      <div
                        key={o.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {(o as unknown as { requests: { title: string } | null }).requests
                              ?.title ?? "Request"}
                          </p>
                          <p className="text-xs text-muted-foreground">{money(o.amount)} · {timeAgo(o.created_at)}</p>
                        </div>
                        <StatusBadge kind="offer" status={o.status} />
                      </div>
                    ))
                  )}
                </div>
              </section>
            </TabsContent>

            {/* ---------------- Reviews ---------------- */}
            <TabsContent value="reviews" className="mt-6 space-y-3">
              {(reviews?.length ?? 0) === 0 ? (
                <Empty text="No reviews yet. Complete a project as a helper to earn your first." />
              ) : (
                reviews!.map((rv) => (
                  <div key={rv.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{"★".repeat(rv.rating)}</p>
                      <span className="text-xs text-muted-foreground">{timeAgo(rv.created_at)}</span>
                    </div>
                    {rv.comment && <p className="mt-2 text-sm text-muted-foreground">{rv.comment}</p>}
                  </div>
                ))
              )}
            </TabsContent>

            {/* ---------------- Activity ---------------- */}
            <TabsContent value="activity" className="mt-6">
              {(!activity || activity.length === 0) ? (
                <Empty text="No recent activity. Your actions (offers, orders, disputes) will appear here." />
              ) : (
                <ul className="space-y-2">
                  {activity.map((e: any) => (
                    <li key={e.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{e.type.replace(/\\./g, ' ')}</p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">{e.payload ? JSON.stringify(e.payload) : ''}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

+            {/* ---------------- Transactions ---------------- */}
+            <TabsContent value="transactions" className="mt-6">
+              {(!transactions || transactions.length === 0) ? (
+                <Empty text="No transactions on your account yet." />
+              ) : (
+                <ul className="space-y-2">
+                  {transactions.map((t: any) => (
+                    <li key={t.id} className="rounded-2xl border border-border bg-card p-4">
+                      <div className="flex items-center justify-between gap-3">
+                        <div className="min-w-0">
+                          <p className="text-sm font-semibold">{t.kind.replace(/_/g, ' ')}</p>
+                          <p className="mt-0.5 text-sm text-muted-foreground">{t.note}</p>
+                        </div>
+                        <div className="text-right">
+                          <div className={`font-medium ${Number(t.amount) >= 0 ? 'text-success' : 'text-destructive'}`}>{money(Number(t.amount))}</div>
+                          <div className="text-xs text-muted-foreground">{timeAgo(t.created_at)}</div>
+                        </div>
+                      </div>
+                    </li>
+                  ))}
+                </ul>
+              )}
+            </TabsContent>

          </Tabs>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

function OrderCard({
  order,
  side,
}: {
  order: {
    id: string;
    title: string;
    amount: number;
    status: string;
    created_at: string;
    delivery_note: string;
  };
  side: "learner" | "helper";
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{order.title || "Project"}</h3>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{money(order.amount)} · started {timeAgo(order.created_at)}</p>
      {order.delivery_note && (
        <p className="mt-2 rounded-xl bg-secondary/60 p-3 text-sm">{order.delivery_note}</p>
      )}
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link to="/messages">
            <MessageSquare className="size-4" /> Chat
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link to="/dashboard">{side === "learner" ? "Manage escrow" : "Deliver work"}</Link>
        </Button>
      </div>
    </article>
  );
}
