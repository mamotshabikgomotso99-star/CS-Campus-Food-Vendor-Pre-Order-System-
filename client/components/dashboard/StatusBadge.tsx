type StatusBadgeProps = {
  status: string;
};

const statusColors: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Confirmed: "bg-violet-100 text-violet-700",
  Preparing: "bg-violet-100 text-violet-700",
  "Ready for Collection": "bg-emerald-100 text-emerald-700",
  Collected: "bg-slate-200 text-slate-700",
  Cancelled: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        statusColors[status] ?? "bg-violet-100 text-violet-700",
      ].join(" ")}
    >
      {status}
    </span>
  );
}
