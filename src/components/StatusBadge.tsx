import { cn } from "@/lib/utils";
import { DISPUTE_STATUS, OFFER_STATUS, ORDER_STATUS } from "@/lib/format";

const MAPS = { order: ORDER_STATUS, offer: OFFER_STATUS, dispute: DISPUTE_STATUS };

export function StatusBadge({
  kind = "order",
  status,
  className,
}: {
  kind?: keyof typeof MAPS;
  status: string;
  className?: string;
}) {
  const meta = MAPS[kind][status] ?? {
    label: status.replace(/_/g, " "),
    className: "bg-secondary text-secondary-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
