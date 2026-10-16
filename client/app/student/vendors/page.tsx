"use client";

import { List, Map as MapIcon, Search, SlidersHorizontal, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { VendorCoverImage } from "@/components/menu/VendorCoverImage";
import { CampusVendorMap } from "@/components/map/CampusVendorMap";
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
  collectionLocation: string | null;
  latitude: number | null;
  longitude: number | null;
};

function buildVendorSummaries(items: MenuApiItem[]): VendorSummary[] {
  const map = new Map<string, VendorSummary>();

  for (const item of items) {
    const existing = map.get(item.vendorId);
    if (existing) {
      if (!existing.imageUrl && item.imageUrl) {
        existing.imageUrl = resolveApiUrl(item.imageUrl);
      }
      if (!existing.collectionLocation && item.collectionLocation) {
        existing.collectionLocation = item.collectionLocation;
      }
      if (existing.latitude === null && existing.longitude === null && item.latitude != null && item.longitude != null) {
        existing.latitude = item.latitude;
        existing.longitude = item.longitude;
      }
      continue;
    }

    map.set(item.vendorId, {
      id: item.vendorId,
      name: item.vendor,
      category: item.category,
      description: `${item.vendor} is serving fresh campus favourites and collection-ready meals.`,
      imageUrl: item.imageUrl ? resolveApiUrl(item.imageUrl) : null,
      isOpen: true,
      eta: "Ready now",
      rating: 4.8,
      accent: "from-violet-100 via-violet-50 to-slate-100",
      collectionLocation: item.collectionLocation ?? null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
    });
  }

  return Array.from(map.values());
}

export default function StudentVendorsPage() {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

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
        setError(requestError instanceof Error ? requestError.message : "Unable to load vendors.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const filteredVendors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vendors;
    return vendors.filter((vendor) =>
      vendor.name.toLowerCase().includes(term) ||
      vendor.category.toLowerCase().includes(term) ||
      vendor.collectionLocation?.toLowerCase().includes(term),
    );
  }, [searchTerm, vendors]);
  const mappedVendors = filteredVendors.filter((vendor) => vendor.latitude !== null && vendor.longitude !== null);

  return (
    <RequireAuth role="student">
      <DashboardLayout
        role="student"
        title="Explore Vendors"
        subtitle="Browse campus food options and pick the one that suits your cravings."
      >
        <section className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendors"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </button>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Vendor view">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                  title="List view"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${viewMode === "list" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <List aria-hidden="true" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  aria-pressed={viewMode === "map"}
                  title="Map view"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${viewMode === "map" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <MapIcon aria-hidden="true" size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading && !error ? (
          <p className="mt-5 text-sm text-slate-500">Loading live vendors...</p>
        ) : null}

        {!error && !isLoading && filteredVendors.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">No vendors match your search right now.</p>
        ) : null}

        {viewMode === "map" && !isLoading && !error ? (
          <section className="mt-5 space-y-4">
            <CampusVendorMap
              vendors={mappedVendors.map((vendor) => ({
                  id: vendor.id,
                  name: vendor.name,
                  collectionLocation: vendor.collectionLocation,
                  latitude: vendor.latitude,
                  longitude: vendor.longitude,
                  href: `/student/vendors/${vendor.id}`,
              }))}
            />
            {mappedVendors.length === 0 ? (
              <p role="status" className="border-t border-slate-200 pt-3 text-sm text-slate-600">
                No vendor locations have been confirmed on the map yet.
              </p>
            ) : null}
            {filteredVendors.some((vendor) => vendor.latitude === null || vendor.longitude === null) ? (
              <div className="border-t border-slate-200 pt-3">
                <h3 className="text-sm font-semibold text-slate-800">Location pin not available</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {filteredVendors.filter((vendor) => vendor.latitude === null || vendor.longitude === null).map((vendor) =>
                    `${vendor.name}${vendor.collectionLocation ? ` · ${vendor.collectionLocation}` : ""}`,
                  ).join("; ")}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {viewMode === "list" ? (
        <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm">
              <VendorCoverImage
                key={`${vendor.id}:${vendor.imageUrl ?? ""}`}
                vendorId={vendor.id}
                vendorName={vendor.name}
                imageUrl={vendor.imageUrl}
                className={`mb-4 h-48 rounded-[22px] bg-gradient-to-br ${vendor.accent} transition-transform duration-300 hover:scale-[1.02]`}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{vendor.name}</h3>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{vendor.category}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  {vendor.isOpen ? "Open" : "Closed"}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">{vendor.description}</p>
              <p className="mt-2 inline-flex items-start gap-2 text-sm text-slate-600">
                <MapIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>{vendor.collectionLocation || "Collection point not listed"}</span>
              </p>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>{vendor.eta}</span>
                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                  <Star className="h-4 w-4 fill-violet-500 text-violet-500" />
                  {vendor.rating}
                </span>
              </div>
              <Link
                href={`/student/vendors/${vendor.id}`}
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#918FD0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7F7DC0]"
              >
                View Menu
              </Link>
            </div>
          ))}
        </section>
        ) : null}
      </DashboardLayout>
    </RequireAuth>
  );
}
