import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { SUBJECTS } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/post")({
  component: PostRequest,
});

const schema = z.object({
  title: z.string().trim().min(6, "Give your request a clearer title").max(120),
  subject: z.string().trim().min(1, "Pick a subject"),
  topic: z.string().trim().max(120),
  description: z.string().trim().min(20, "Add a bit more detail (20+ characters)").max(4000),
});

function PostRequest() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("40");
  const [deadline, setDeadline] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "urgent">("normal");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ title, subject, topic, description });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    const budgetValue = Number(budget);
    if (!Number.isFinite(budgetValue) || budgetValue <= 0 || budgetValue > 100000) {
      toast.error("Set a budget between 1 and 100,000");
      return;
    }
    setBusy(true);

    let attachmentUrl: string | null = null;
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setBusy(false);
        toast.error("Attachments must be under 20MB");
        return;
      }
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
      if (upErr) {
        setBusy(false);
        toast.error(upErr.message);
        return;
      }
      attachmentUrl = path;
    }

    const { error } = await supabase.from("requests").insert({
      learner_id: user.id,
      title: parsed.data.title,
      subject: parsed.data.subject,
      topic: parsed.data.topic,
      description: parsed.data.description,
      urgency,
      budget: budgetValue,
      deadline: deadline || null,
      attachment_url: attachmentUrl,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request posted — helpers can now reach out.");
    navigate({ to: "/browse", search: { subject: parsed.data.subject } });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Post a request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The clearer the detail, the faster the right person finds you.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Debug a recursive function in Python"
              required
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={120}
                placeholder="Recursion, base cases"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={7}
              placeholder="What have you tried? What's the deadline? Paste error messages or the question here."
              required
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget">Your budget (USD)</Label>
              <Input
                id="budget"
                type="number"
                min={1}
                max={100000}
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Held in escrow once you accept a helper's offer.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Urgency</Label>
            <div className="flex flex-wrap gap-2">
              {(["low", "normal", "urgent"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    urgency === u
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Attachment (optional)</Label>
            <label
              htmlFor="file"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/50"
            >
              <Paperclip className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{file ? file.name : "Attach a file (≤20MB)"}</span>
            </label>
            <input
              id="file"
              type="file"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Post request
          </Button>
        </form>
      </main>
    </div>
  );
}
