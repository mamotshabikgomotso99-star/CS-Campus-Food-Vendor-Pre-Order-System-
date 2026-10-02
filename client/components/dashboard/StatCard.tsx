import { ArrowUpRight, type LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <ArrowUpRight className="h-3.5 w-3.5 text-violet-700" />
        {hint}
      </div>
    </div>
  );
}
