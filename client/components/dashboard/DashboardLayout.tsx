import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopHeader } from "@/components/dashboard/TopHeader";
import { AuthIdentityProvider } from "@/components/auth/AuthIdentityProvider";

type DashboardLayoutProps = {
  role: "student" | "vendor";
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
};

export function DashboardLayout({ role, title, subtitle, children }: DashboardLayoutProps) {
  return (
    <AuthIdentityProvider>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <div className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <Sidebar role={role} />

            <main className="min-w-0 flex-1 space-y-5">
              <TopHeader title={title} subtitle={subtitle} role={role} />
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthIdentityProvider>
  );
}
