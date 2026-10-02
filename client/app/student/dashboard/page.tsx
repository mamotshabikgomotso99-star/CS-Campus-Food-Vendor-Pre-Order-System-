import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StudentDashboardGreeting } from "@/components/auth/AuthIdentityProvider";
import { StudentOrderOverview } from "@/components/orders/StudentOrderOverview";
import {
  featuredVendors,
  vendorMenuById,
} from "@/lib/dashboard-data";

export default function StudentDashboardPage() {
  return (
    <DashboardLayout
      role="student"
      title={<StudentDashboardGreeting />}
      subtitle="Find your favourite campus meals and skip the queue."
    >
      <section className="rounded-[28px] border border-white/60 bg-gradient-to-r from-[#B8B7E5] to-[#D8D7F2] p-5 text-slate-900 shadow-[0_18px_40px_rgba(124,58,237,0.12)] sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-800/75">
              Student overview
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Ready for your next meal?</h2>
          </div>
          <Link
            href="/student/vendors"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
          >
            Browse Vendors
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <StudentOrderOverview />

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-900">Browse Vendors</h3>
            <Link href="/student/vendors" className="text-sm font-medium text-violet-700 hover:text-violet-800">
              View all
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {featuredVendors.map((vendor) => (
              <div key={vendor.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                <div className={`mb-3 h-40 overflow-hidden rounded-[20px] bg-gradient-to-br ${vendor.accent}`}>
                  <img
                    src={vendorMenuById[vendor.id]?.[0]?.imageUrl}
                    alt={`${vendor.name} featured menu item`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{vendor.name}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{vendor.category}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    {vendor.isOpen ? "Open" : "Closed"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{vendor.description}</p>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <span>{vendor.eta}</span>
                  <span>⭐ {vendor.rating}</span>
                </div>
                <Link
                  href={`/student/vendors/${vendor.id}`}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[#918FD0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7F7DC0]"
                >
                  View Menu
                </Link>
              </div>
            ))}
          </div>
        </div>

      </section>

    </DashboardLayout>
  );
}
