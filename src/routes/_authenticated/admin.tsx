import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin dashboard · PeerBoost" }] }),
});

function AdminPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");

  const { data: me } = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,is_admin").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const users = useQuery({
    queryKey: ["admin-users", query],
    queryFn: async () => {
      const q = supabase.from("profiles").select("id,full_name,headline,is_admin,suspended,created_at").order("created_at", { ascending: false }).limit(200);
      if (query) q.textSearch('full_name', query);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!me,
  });

  const events = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_events").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!me && me.is_admin,
  });

  const setAdmin = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      const { error } = await supabase.rpc("set_user_admin", { _user_id: id, _is_admin: isAdmin });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(["admin-users"]);
      qc.invalidateQueries(["profile-me"]);
    },
  });

  const setSuspended = useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) => {
      const { error } = await supabase.rpc("set_user_suspended", { _user_id: id, _suspended: suspended });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(["admin-users"]),
  });

  if (!me) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!me.is_admin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-10">
          <h1 className="text-2xl font-bold">Admin dashboard</h1>
          <p className="mt-4 text-muted-foreground">You must be an admin to view this page.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin dashboard</h1>
        </div>

        <section className="mt-6">
          <h2 className="font-semibold">Users</h2>
          <div className="mt-3 flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users" />
            <Button onClick={() => qc.invalidateQueries(["admin-users", query])}>Search</Button>
          </div>

          <ul className="mt-4 space-y-2">
            {(users.data ?? []).map((u: any) => (
              <li key={u.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                <div>
                  <div className="font-semibold">{u.full_name || u.id}</div>
                  <div className="text-xs text-muted-foreground">{u.headline}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={u.is_admin ? "destructive" : "secondary"} onClick={() => setAdmin.mutate({ id: u.id, isAdmin: !u.is_admin })}>
                    {setAdmin.isLoading ? <Loader2 className="size-4 animate-spin" /> : u.is_admin ? "Revoke admin" : "Make admin"}
                  </Button>
                  <Button size="sm" variant={u.suspended ? "destructive" : "ghost"} onClick={() => setSuspended.mutate({ id: u.id, suspended: !u.suspended })}>
                    {setSuspended.isLoading ? <Loader2 className="size-4 animate-spin" /> : u.suspended ? "Unsuspend" : "Suspend"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="font-semibold">Recent events</h2>
          <ul className="mt-3 space-y-2">
            {(events.data ?? []).map((e: any) => (
              <li key={e.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{e.type}</div>
                    <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                    <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(e.payload ?? {}, null, 2)}</pre>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
