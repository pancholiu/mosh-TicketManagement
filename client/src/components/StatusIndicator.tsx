import { cn } from "@/lib/utils";

export type TicketStatus = "NEW" | "PROCESSING" | "OPEN" | "RESOLVED" | "CLOSED";

export const STATUS_META: Record<TicketStatus, { label: string; dot: string; text: string }> = {
  NEW: { label: "New", dot: "bg-new", text: "text-new" },
  PROCESSING: { label: "Processing", dot: "bg-signal", text: "text-signal" },
  OPEN: { label: "Open", dot: "bg-chart-1", text: "text-chart-1" },
  RESOLVED: { label: "Resolved", dot: "bg-resolved", text: "text-resolved" },
  CLOSED: { label: "Closed", dot: "bg-closed", text: "text-closed" },
};

// PROCESSING is the one state where the AI is actively working the ticket —
// it's the only dot that pulses, echoing the signal-violet-means-AI rule.
export function StatusIndicator({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider",
        meta.text,
        className
      )}
    >
      <span className="relative flex size-1.5 shrink-0">
        {status === "PROCESSING" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              meta.dot
            )}
          />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", meta.dot)} />
      </span>
      {meta.label}
    </span>
  );
}
