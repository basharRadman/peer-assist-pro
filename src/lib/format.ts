export function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export const ORDER_STATUS: Record<
  string,
  { label: string; className: string }
> = {
  in_escrow: { label: "In escrow", className: "bg-success-soft text-success" },
  under_review: { label: "Under review", className: "bg-accent-soft text-accent-foreground" },
  completed: { label: "Completed", className: "bg-primary-soft text-primary" },
  refunded: { label: "Refunded", className: "bg-secondary text-secondary-foreground" },
  disputed: { label: "Disputed", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", className: "bg-secondary text-secondary-foreground" },
};

export const OFFER_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-secondary text-secondary-foreground" },
  accepted: { label: "Accepted", className: "bg-success-soft text-success" },
  declined: { label: "Declined", className: "bg-destructive/10 text-destructive" },
  withdrawn: { label: "Withdrawn", className: "bg-secondary text-secondary-foreground" },
};

export const DISPUTE_STATUS: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-destructive/10 text-destructive" },
  resolved_released: { label: "Released to helper", className: "bg-success-soft text-success" },
  resolved_refunded: { label: "Refunded to learner", className: "bg-primary-soft text-primary" },
  rejected: { label: "Rejected", className: "bg-secondary text-secondary-foreground" },
};

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
