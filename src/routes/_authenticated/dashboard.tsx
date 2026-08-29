import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Plus,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { money, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Learner dashboard — PeerBoost" },
      {
        name: "description",
        content:
          "Track your active requests, review helper offers, monitor escrow payments and follow open disputes in one place.",
      },
      { property: "og:title", content: "Learner dashboard — PeerBoost" },
      {
        property: "og:description",
        content: "Manage requests, offers, escrow and disputes on PeerBoost.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Card({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className={`inline-grid size-9 place-items-center rounded-xl ${tone}`}>
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function Dashboard() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [topup, setTopup] = useState(false);
  const [amount, setAmount] = useState("100");
  const [disputeOrder, setDisputeOrder] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const wallet = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_wallet", { _user_id: user!.id });
      if (error) throw error;
      return data?.[0] ?? { balance: 0, escrow_held: 0, earnings: 0 };
    },
  });

  const requests = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("requests")
        .select("*")
        .eq("learner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (rows ?? []).map((r) => r.id);
      const { data: offers } = ids.length
        ? await supabase
            .from("offers")
            .select("id, request_id, helper_id, amount, message, status, created_at")
            .in("request_id", ids)
            .order("created_at", { ascending: true })
        : { data: [] };

      const helperIds = [...new Set((offers ?? []).map((o) => o.helper_id))];
      const { data: helpers } = helperIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, headline, rating, completed_count")
            .in("id", helperIds)
        : { data: [] };
      const byId = new Map((helpers ?? []).map((h) => [h.id, h]));

      return (rows ?? []).map((r) => ({
        ...r,
        offers: (offers ?? [])
          .filter((o) => o.request_id === r.id)
          .map((o) => ({ ...o, helper: byId.get(o.helper_id) ?? null })),
      }));
    },
  });

  const orders = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("learner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const disputes = useQuery({
    queryKey: ["my-disputes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["my-requests"] });
    qc.invalidateQueries({ queryKey: ["my-orders"] });
    qc.invalidateQueries({ queryKey: ["my-disputes"] });
  }

  const acceptOffer = useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase.rpc("accept_offer", { _offer_id: offerId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offer accepted — funds are locked in escrow.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc("release_escrow", { _order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work approved — payment released to the helper.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFunds = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase.rpc("add_demo_funds", { _amount: value });
      if (error) throw error;
    },
    onSuccess: () => {
      setTopup(false);
      toast.success("Funds added to your wallet.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDispute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("raise_dispute", {
        _order_id: disputeOrder!.id,
        _reason: reason.trim(),
        _details: details.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDisputeOrder(null);
      setReason("");
      setDetails("");
      toast.success("Dispute submitted — an admin will review it.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const w = wallet.data;
  const disputeByOrder = new Map((disputes.data ?? []).map((d) => [d.order_id, d]));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">Learner dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your requests, offers, escrow payments and disputes.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/post">
              <Plus className="size-4" /> New request
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card
            label="Available balance"
            value={money(w?.balance ?? 0)}
            icon={Wallet}
            tone="bg-primary-soft text-primary"
          />
          <Card
            label="Held in escrow"
            value={money(w?.escrow_held ?? 0)}
            icon={ShieldCheck}
            tone="bg-success-soft text-success"
          />
          <Card
            label="Open disputes"
            value={String((disputes.data ?? []).filter((d) => d.status === "open").length)}
            icon={AlertTriangle}
            tone="bg-destructive/10 text-destructive"
          />
        </div>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setTopup(true)}>
          Add funds
        </Button>

        {/* Active requests + offers */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Your requests</h2>
          {requests.isLoading ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (requests.data ?? []).length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="font-semibold">No requests yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Post your first request to start receiving offers.
              </p>
              <Button asChild className="mt-5">
                <Link to="/post">Post a request</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {(requests.data ?? []).map((r) => (
                <li key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                      {r.subject}
                    </span>
                    <StatusBadge kind="offer" status={r.status === "open" ? "pending" : "accepted"} />
                    <span className="ml-auto rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success">
                      Budget {money(r.budget)}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold">{r.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{timeAgo(r.created_at)}</span>
                    {r.deadline && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" /> due{" "}
                        {new Date(r.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {r.offers.length} offer{r.offers.length === 1 ? "" : "s"}
                    </p>
                    {r.offers.length > 0 && (
                      <ul className="mt-3 space-y-3">
                        {r.offers.map((o) => (
                          <li
                            key={o.id}
                            className="flex flex-wrap items-start gap-3 rounded-xl bg-secondary/60 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <Link
                                to="/u/$id"
                                params={{ id: o.helper_id }}
                                className="text-sm font-medium hover:underline"
                              >
                                {o.helper?.full_name || "Helper"}
                              </Link>
                              <p className="text-[11px] text-muted-foreground">
                                {Number(o.helper?.rating ?? 0).toFixed(1)} ★ ·{" "}
                                {o.helper?.completed_count ?? 0} completed
                              </p>
                              {o.message && (
                                <p className="mt-1 text-xs text-muted-foreground">{o.message}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-sm font-bold">{money(o.amount)}</span>
                              {o.status === "pending" ? (
                                <Button
                                  size="sm"
                                  disabled={acceptOffer.isPending}
                                  onClick={() => acceptOffer.mutate(o.id)}
                                >
                                  {acceptOffer.isPending && (
                                    <Loader2 className="size-4 animate-spin" />
                                  )}
                                  Accept
                                </Button>
                              ) : (
                                <StatusBadge kind="offer" status={o.status} />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Orders / escrow */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Escrow &amp; orders</h2>
          {(orders.data ?? []).length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Accepted offers appear here with their escrow status.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(orders.data ?? []).map((o) => {
                const d = disputeByOrder.get(o.id);
                return (
                  <li
                    key={o.id}
                    className="rounded-2xl border border-border bg-card p-5 shadow-card"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={o.status} />
                      {d && <StatusBadge kind="dispute" status={d.status} />}
                      <span className="ml-auto text-sm font-bold">{money(o.amount)}</span>
                    </div>
                    <h3 className="mt-3 font-semibold">{o.title || "Order"}</h3>
                    {o.delivery_note && (
                      <p className="mt-2 text-sm text-muted-foreground">{o.delivery_note}</p>
                    )}
                    {o.delivery_url && (
                      <a
                        href={o.delivery_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        View delivered work
                      </a>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/messages">Chat with helper</Link>
                      </Button>
                      {["in_escrow", "under_review", "disputed"].includes(o.status) && (
                        <Button
                          size="sm"
                          disabled={release.isPending}
                          onClick={() => release.mutate(o.id)}
                        >
                          <CheckCircle2 className="size-4" /> Approve &amp; release
                        </Button>
                      )}
                      {["in_escrow", "under_review"].includes(o.status) && !d && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDisputeOrder({ id: o.id, title: o.title })}
                        >
                          <AlertTriangle className="size-4" /> Raise dispute
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Disputes */}
        {(disputes.data ?? []).length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Disputes</h2>
            <ul className="mt-4 space-y-3">
              {(disputes.data ?? []).map((d) => (
                <li key={d.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="dispute" status={d.status} />
                    <span className="text-xs text-muted-foreground">{timeAgo(d.created_at)}</span>
                  </div>
                  <p className="mt-2 font-medium">{d.reason}</p>
                  {d.details && (
                    <p className="mt-1 text-sm text-muted-foreground">{d.details}</p>
                  )}
                  {d.resolution_note && (
                    <p className="mt-2 rounded-xl bg-secondary p-3 text-xs">{d.resolution_note}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Dialog open={topup} onOpenChange={setTopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add demo funds</DialogTitle>
            <DialogDescription>
              Top up your wallet balance so you can accept offers and fund escrow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="topup-amount">Amount (USD)</Label>
            <Input
              id="topup-amount"
              type="number"
              min={1}
              max={5000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTopup(false)}>
              Cancel
            </Button>
            <Button
              disabled={addFunds.isPending}
              onClick={() => {
                const value = Number(amount);
                if (!Number.isFinite(value) || value <= 0 || value > 5000) {
                  toast.error("Enter an amount between 1 and 5000");
                  return;
                }
                addFunds.mutate(value);
              }}
            >
              {addFunds.isPending && <Loader2 className="size-4 animate-spin" />} Add funds
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disputeOrder} onOpenChange={(o) => !o && setDisputeOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise a dispute</DialogTitle>
            <DialogDescription className="truncate">{disputeOrder?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dispute-reason">Reason</Label>
              <Input
                id="dispute-reason"
                value={reason}
                maxLength={120}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Work not delivered as agreed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispute-details">Details</Label>
              <Textarea
                id="dispute-details"
                rows={4}
                maxLength={2000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Explain what went wrong so an admin can review it."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Escrow stays locked until an admin reviews the chat, files and delivery.
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDisputeOrder(null)}>
              Cancel
            </Button>
            <Button
              disabled={openDispute.isPending}
              onClick={() => {
                if (reason.trim().length < 4) {
                  toast.error("Add a short reason");
                  return;
                }
                openDispute.mutate();
              }}
            >
              {openDispute.isPending && <Loader2 className="size-4 animate-spin" />} Submit dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
