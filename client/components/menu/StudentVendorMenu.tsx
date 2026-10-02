"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ShoppingBag, Star, TimerReset } from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { featuredVendors, vendorMenuById } from "@/lib/dashboard-data";
import { getMenuItems, resolveApiUrl, type MenuApiItem } from "@/lib/api";

export function StudentVendorMenu({ vendorId }: { vendorId: string }) {
  const [items, setItems] = useState<MenuApiItem[] | null>(null);
  const [error, setError] = useState("");
  const vendor = featuredVendors.find((item) => item.id === vendorId);
  const vendorName = items?.[0]?.vendor ?? vendor?.name ?? "Vendor";
  const existingImages = useMemo(
    () => new Map((vendorMenuById[vendorId] ?? []).map((item) => [item.id, item.imageUrl])),
    [vendorId],
  );

  useEffect(() => {
    let isCurrent = true;
    void getMenuItems(vendorId).then((response) => {
      if (isCurrent) {
        setItems(response.items);
        setError("");
      }
    }).catch((requestError: unknown) => {
      if (isCurrent) setError(requestError instanceof Error ? requestError.message : "Unable to load this menu.");
    });
    return () => { isCurrent = false; };
  }, [vendorId]);

  const heroImage = items?.map((item) => item.imageUrl ? resolveApiUrl(item.imageUrl) : existingImages.get(item.id)).find(Boolean);

  return (
    <DashboardLayout
      role="student"
      title={vendorName}
      subtitle="Browse the current menu and place a pre-order for collection."
    >
      <section className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/student/vendors" className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-800">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to vendors
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
            Order for collection
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="relative flex min-h-52 items-end overflow-hidden rounded-[20px] bg-gradient-to-br from-[#B8B7E5] to-[#D8D7F2] p-5 text-slate-900">
            {heroImage ? <img src={heroImage} alt={`${vendorName} menu`} className="absolute inset-0 h-full w-full object-cover opacity-35" /> : null}
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Campus menu</p>
              <h2 className="mt-2 text-3xl font-semibold">{vendorName}</h2>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-violet-900/75">
                <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-current" aria-hidden="true" />{vendor?.rating ?? 4.8} rating</span>
                <span className="inline-flex items-center gap-1"><TimerReset className="h-4 w-4" aria-hidden="true" />{vendor?.eta ?? "Collection times available at checkout"}</span>
              </div>
            </div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Menu summary</p>
            <dl className="mt-3 space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3"><dt>Items available</dt><dd className="font-semibold text-slate-900">{items === null ? "—" : items.length}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt>Category</dt><dd className="font-semibold text-slate-900">{vendor?.category ?? "Campus food"}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Menu</h2>
          <Link href={`/student/orders/new?vendorId=${encodeURIComponent(vendorId)}`} className="text-sm font-medium text-violet-700 hover:text-violet-800">Start order</Link>
        </div>
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {items === null && !error ? <p className="py-8 text-sm text-slate-500">Loading available menu items...</p> : null}
        {items?.length === 0 ? <p className="py-8 text-center text-sm text-slate-600">No items are currently available from this vendor.</p> : null}
        {items && items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const image = item.imageUrl ? resolveApiUrl(item.imageUrl) : existingImages.get(item.id);
              return (
                <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {image ? (
                    <img src={image} alt={item.name} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-gradient-to-br from-violet-100 to-slate-100 text-violet-700">
                      <ShoppingBag className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{item.category}</p>
                      </div>
                      <span className="shrink-0 font-semibold text-violet-800">{new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(item.priceCents / 100)}</span>
                    </div>
                    {item.description ? <p className="mt-2 text-sm text-slate-600">{item.description}</p> : null}
                    <Link href={`/student/orders/new?vendorId=${encodeURIComponent(vendorId)}&itemId=${encodeURIComponent(item.id)}`} className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800">
                      Order item
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </DashboardLayout>
  );
}