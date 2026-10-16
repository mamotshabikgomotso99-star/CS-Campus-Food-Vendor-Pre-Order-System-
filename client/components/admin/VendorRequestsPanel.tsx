"use client";

import { Check, Clock3, LogOut, RefreshCw, Store, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthIdentity } from "@/lib/auth-session";
import { getVendorRequests, logoutUser, reviewVendorRequest, type VendorRequest } from "@/lib/api";

export function VendorRequestsPanel() {
  const router = useRouter();
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const result = await getVendorRequests();
        if (isActive) setRequests(result.requests);
      } catch (loadError) {
        if (isActive) setError(loadError instanceof Error ? loadError.message : "Unable to load vendor applications.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    void load();
    return () => { isActive = false; };
  }, [refreshKey]);

  const decide = async (request: VendorRequest, status: "approved" | "rejected") => {
    setBusyRequestId(request.id);
    setError("");
    setMessage("");
    try {
      const result = await reviewVendorRequest(request.id, status);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setMessage(`${request.vendorName}: ${result.message}`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review this application.");
    } finally {
      setBusyRequestId(null);
    }
  };

  const signOut = async () => {
    await logoutUser().catch(() => {});
    clearAuthIdentity();
    router.replace("/admin/login");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Campus Eats</p><h1 className="mt-1 text-xl font-semibold">Admin review</h1></div>
          <div className="flex items-center gap-2">
            <Link href="/admin/locations" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Vendor locations</Link>
            <button type="button" onClick={signOut} title="Sign out" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><LogOut aria-hidden="true" size={16} /><span>Sign out</span></button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div><h2 className="text-2xl font-semibold">Vendor applications</h2><p className="mt-1 text-sm text-slate-600">Review requests before vendor accounts are activated.</p></div>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)} disabled={isLoading} title="Refresh applications" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw aria-hidden="true" size={17} className={isLoading ? "animate-spin" : ""} /></button>
        </div>
        {error ? <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
        {isLoading ? <p className="py-16 text-center text-sm text-slate-600">Loading vendor applications...</p> : requests.length === 0 ? (
          <div className="py-16 text-center"><Store aria-hidden="true" className="mx-auto text-slate-400" size={28} /><p className="mt-3 font-medium text-slate-800">No pending applications</p><p className="mt-1 text-sm text-slate-500">New vendor requests will appear here.</p></div>
        ) : (
          <div className="divide-y divide-slate-200">
            {requests.map((request) => (
              <article key={request.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="font-semibold">{request.vendorName}</h3><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Pending</span></div>
                  <p className="mt-1 text-sm text-slate-600">{request.category} · {request.fullName}</p>
                  <p className="mt-1 break-all text-sm text-slate-500">{request.email}</p>
                  <p className="mt-1 text-sm text-slate-600">Collection: {request.collectionLocation || "Not provided"} · {request.openingTime && request.closingTime ? `${request.openingTime.slice(0, 5)} to ${request.closingTime.slice(0, 5)}` : "Hours not provided"} · {request.preparationTimeMinutes ? `${request.preparationTimeMinutes} min prep` : "Prep time not provided"}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500"><Clock3 aria-hidden="true" size={13} /> Submitted {new Date(request.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void decide(request, "approved")} disabled={busyRequestId !== null} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><Check aria-hidden="true" size={16} />Approve</button>
                  <button type="button" onClick={() => void decide(request, "rejected")} disabled={busyRequestId !== null} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><X aria-hidden="true" size={16} />Reject</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}