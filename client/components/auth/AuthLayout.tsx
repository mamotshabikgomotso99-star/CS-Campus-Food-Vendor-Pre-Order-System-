import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#B8B7E5] text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-[#FCE7F3]/90 blur-[2px]" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-[#A8A29E]/35" />
      <div className="pointer-events-none absolute left-1/2 top-16 h-28 w-28 -translate-x-1/2 rounded-full bg-white/20 blur-2xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-white/80 shadow-[0_18px_40px_rgba(124,58,237,0.18)] backdrop-blur-sm">
              <div className="relative h-9 w-9">
                <div className="absolute left-1/2 top-0 h-3 w-7 -translate-x-1/2 rounded-t-[12px] rounded-b-[4px] bg-violet-700" />
                <div className="absolute left-1/2 top-1 h-3 w-8 -translate-x-1/2 rounded-[10px] border-2 border-violet-700 bg-white/80" />
                <div className="absolute left-1/2 top-3 h-2 w-5 -translate-x-1/2 rounded-full bg-violet-700" />
                <div className="absolute left-1 top-4 h-3 w-1.5 rounded-full bg-violet-700" />
                <div className="absolute right-1 top-4 h-3 w-1.5 rounded-full bg-violet-700" />
                <div className="absolute left-1/2 top-4 h-3 w-5 -translate-x-1/2 rounded-b-[10px] bg-violet-700" />
                <div className="absolute left-1/2 top-5 h-3 w-6 -translate-x-1/2 rounded-full bg-violet-700" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-800/80">
                Campus Eats
              </p>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/50 bg-white/70 p-4 shadow-[0_28px_60px_rgba(76,29,149,0.12)] backdrop-blur-sm sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
