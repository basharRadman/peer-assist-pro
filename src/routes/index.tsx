import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Search, Sparkle, MessagesSquare, CheckCircle2, Star } from "lucide-react";

import heroImage from "@/assets/hero-collab.jpg";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUBJECTS } from "@/lib/subjects";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeerBoost — Get instant help with homework & projects" },
      {
        name: "description",
        content:
          "Find a peer or mentor for programming, accounting, engineering, languages and more. Post your task, match by subject, and solve it together.",
      },
      { property: "og:title", content: "PeerBoost — Peer help for homework & projects" },
      {
        property: "og:description",
        content:
          "Post a task, match with a peer who knows the subject, and finish your assignment together.",
      },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    title: "Post your task or search an expert",
    body: "Describe the assignment, add files, and set how urgent it is.",
    icon: Sparkle,
  },
  {
    title: "Connect via subject matching",
    body: "Helpers who know your subject see your request and reach out.",
    icon: MessagesSquare,
  },
  {
    title: "Get help & complete",
    body: "Work through it in chat, share files, and mark it done.",
    icon: CheckCircle2,
  },
];

function Landing() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SUBJECTS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q),
    ).slice(0, 5);
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-40 -right-32 size-[34rem] rounded-full bg-primary-soft blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                <Star className="size-3.5 text-accent" /> Peer-to-peer learning marketplace
              </span>
              <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold text-balance sm:text-5xl lg:text-6xl">
                Get instant help with your <span className="text-gradient-brand">homework</span> &
                projects
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                Stuck on a deadline? Match with peers and mentors who actually know your subject —
                from Python bugs to balance sheets — and solve it together.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/browse">
                    Find help now <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/auth">Become a helper</Link>
                </Button>
              </div>

              <div className="relative mt-8 max-w-md">
                <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a subject or skill — e.g. calculus, Figma, IFRS"
                  aria-label="Search subjects"
                  className="h-13 rounded-2xl bg-card pl-11 shadow-card"
                />
                {matches.length > 0 && (
                  <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-lift">
                    {matches.map((m) => (
                      <li key={m.name}>
                        <button
                          type="button"
                          onClick={() => navigate({ to: "/browse", search: { subject: m.name } })}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-secondary"
                        >
                          <m.icon className="size-4 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="font-medium">{m.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {m.blurb}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="relative">
              <img
                src={heroImage}
                alt="Two students working together on an assignment at a laptop"
                width={1408}
                height={1104}
                className="w-full rounded-3xl shadow-lift"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold sm:text-3xl">Browse by discipline</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a field and see who is available right now.
              </p>
            </div>
            <Link
              to="/browse"
              className="shrink-0 text-sm font-semibold text-primary hover:underline"
            >
              See all requests
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SUBJECTS.map((s) => (
              <Link
                key={s.name}
                to="/browse"
                search={{ subject: s.name }}
                className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <s.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{s.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
            <ol className="mt-8 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-bold text-accent-foreground">
                      {i + 1}
                    </span>
                    <step.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="surface-ink grid gap-6 rounded-3xl px-6 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-bold text-balance sm:text-3xl">
              Know a subject well? Turn it into help someone needs today.
            </h2>
            <p className="mx-auto max-w-xl text-sm text-ink-foreground/70">
              Set your subjects, get matched with requests, and build a track record of completed
              help.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Become a helper</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/post">Post a request</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} PeerBoost — learn together, finish faster.
        </div>
      </footer>
    </div>
  );
}
