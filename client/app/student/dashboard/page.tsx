"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { VendorCoverImage } from "@/components/menu/VendorCoverImage";
import { StudentDashboardGreeting } from "@/components/auth/AuthIdentityProvider";
import { StudentOrderOverview } from "@/components/orders/StudentOrderOverview";
import { getMenuItems, resolveApiUrl, type MenuApiItem } from "@/lib/api";

type VendorSummary = {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string | null;
  isOpen: boolean;
  eta: string;
  rating: number;
  accent: string;
};

function buildVendorSummaries(items: MenuApiItem[]): VendorSummary[] {
  const map = new Map<string, VendorSummary>();

  for (const item of items) {
    const existing = map.get(item.vendorId);
    if (existing) {
      if (!existing.imageUrl && item.imageUrl) {
        existing.imageUrl = resolveApiUrl(item.imageUrl);
      }
      continue;
    }

    map.set(item.vendorId, {
      id: item.vendorId,
      name: item.vendor,
      category: item.category,
      description: `${item.vendor} is serving fresh campus favourites right now.`,
      imageUrl: item.imageUrl ? resolveApiUrl(item.imageUrl) : null,
      isOpen: true,
      eta: "Ready for collection",
      rating: 4.8,
      accent: "from-violet-100 via-violet-50 to-slate-100",
    });
  }

  return Array.from(map.values());
}

export default function StudentDashboardPage() {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    void getMenuItems()
      .then((response) => {
        if (!isCurrent) return;
        setVendors(buildVendorSummaries(response.items));
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!isCurrent) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load available vendors.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <RequireAuth role="student">
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

            {error ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {isLoading && !error ? (
              <p className="py-8 text-sm text-slate-500">Loading live campus vendors...</p>
            ) : null}

            {!error && !isLoading && vendors.length === 0 ? (
              <p className="py-8 text-sm text-slate-500">No vendors are currently available.</p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                  <VendorCoverImage
                    vendorId={vendor.id}
                    vendorName={vendor.name}
                    imageUrl={vendor.imageUrl}
                    className={`mb-3 h-40 rounded-[20px] bg-gradient-to-br ${vendor.accent}`}
                  />
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
    </RequireAuth>
  );
}
