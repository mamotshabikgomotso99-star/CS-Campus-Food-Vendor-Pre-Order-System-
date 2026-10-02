"use client";

import type { ReactNode } from "react";
import { Bell, Search, UserCircle2 } from "lucide-react";
import { SignedInName } from "@/components/auth/AuthIdentityProvider";

export function TopHeader({
  title,
  subtitle,
  role,
}: {
  title: ReactNode;
  subtitle: string;
  role: "student" | "vendor";
}) {
  return (
    <header className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            {role === "student" ? "Student dashboard" : "Vendor dashboard"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-[180px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900"><SignedInName /></p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                {role === "student" ? "Student" : "Vendor"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
