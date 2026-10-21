"use client";

import { ArrowLeft, LogOut, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { CampusVendorMap, type CampusMapPoint } from "@/components/map/CampusVendorMap";
import { clearAuthIdentity } from "@/lib/auth-session";
import { getAdminVendorLocations, logoutUser, updateAdminVendorLocation, type VendorMapLocation } from "@/lib/api";

type DraftLocation = { vendorId: string; latitude: string; longitude: string };

function VendorLocationsContent() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorMapLocation[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [draftLocation, setDraftLocation] = useState<DraftLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isActive = true;
    void getAdminVendorLocations()
      .then((response) => {
        if (!isActive) return;
        setVendors(response.vendors);
        setSelectedVendorId(response.vendors.find((vendor) => vendor.id === "student-cafe")?.id ?? response.vendors[0]?.id ?? "");
      })
      .catch((requestError: unknown) => {
        if (isActive) setError(requestError instanceof Error ? requestError.message : "Unable to load vendor locations.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => { isActive = false; };
  }, []);

  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;
  const selectedDraft = draftLocation?.vendorId === selectedVendorId ? draftLocation : null;

  const pickLocation = ({ latitude, longitude }: CampusMapPoint) => {
    if (!selectedVendor) return;
    setDraftLocation({
      vendorId: selectedVendor.id,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });
    setError("");
    setMessage("");
  };

  const updateCoordinate = (field: "latitude" | "longitude", value: string) => {
    if (!selectedVendor) return;
    const currentDraft = selectedDraft ?? {
      vendorId: selectedVendor.id,
      latitude: selectedVendor.latitude?.toString() ?? "",
      longitude: selectedVendor.longitude?.toString() ?? "",
    };
    setDraftLocation({ ...currentDraft, [field]: value });
    setError("");
    setMessage("");
  };

  const saveLocation = async () => {
    if (!selectedVendor || !selectedDraft) return;
    if (!selectedDraft.latitude.trim() || !selectedDraft.longitude.trim()) {
      setError("Enter both campus-confirmed coordinates before saving.");
      return;
    }
    const latitude = Number(selectedDraft.latitude);
    const longitude = Number(selectedDraft.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError("Enter valid latitude and longitude values.");
      return;
    }
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await updateAdminVendorLocation(selectedVendor.id, {
        latitude,
        longitude,
      });
      setVendors((current) => current.map((vendor) => vendor.id === response.vendor.id ? response.vendor : vendor));
      setDraftLocation(null);
      setMessage(`${response.vendor.name} location saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this vendor location.");
    } finally {
      setIsSaving(false);
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:text-violet-900">
              <ArrowLeft aria-hidden="true" size={16} /> Admin review
            </Link>
            <h1 className="mt-1 text-xl font-semibold">Vendor locations</h1>
          </div>
          <button type="button" onClick={signOut} title="Sign out" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <LogOut aria-hidden="true" size={16} /><span>Sign out</span>
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-5 border-b border-slate-200 pb-4">
          <h2 className="text-2xl font-semibold">TUT Soshanguve South</h2>
          <p className="mt-1 text-sm text-slate-600">Select an approved vendor and enter its campus-confirmed coordinates.</p>
        </div>

        {error ? <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

        {isLoading ? <p className="py-16 text-center text-sm text-slate-600" role="status">Loading approved vendors...</p> : vendors.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-medium text-slate-800">No approved vendor locations</p>
            <p className="mt-1 text-sm text-slate-500">Approved vendors with a collection point will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
            <aside className="min-w-0 border-b border-slate-200 pb-4 xl:border-b-0 xl:border-r xl:pr-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Approved vendors</h3>
              <div className="divide-y divide-slate-200">
                {vendors.map((vendor) => {
                  const hasPin = vendor.latitude !== null && vendor.longitude !== null;
                  const isSelected = vendor.id === selectedVendorId;
                  return (
                    <button
                      key={vendor.id}
                      type="button"
                      onClick={() => {
                        setSelectedVendorId(vendor.id);
                        setError("");
                        setMessage("");
                      }}
                      aria-pressed={isSelected}
                      className={`w-full px-2 py-3 text-left transition ${isSelected ? "bg-emerald-50" : "hover:bg-slate-100"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">{vendor.name}</span>
                        <span className={`text-xs font-medium ${hasPin ? "text-emerald-700" : "text-amber-700"}`}>
                          {hasPin ? "Pinned" : "Pin needed"}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {vendor.collectionLocation ?? (vendor.id === "student-cafe" ? "Campus cafeteria" : "Collection point not provided")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0">
              {selectedVendor ? (
                <>
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{selectedVendor.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Collection: {selectedVendor.collectionLocation ?? (selectedVendor.id === "student-cafe" ? "Campus cafeteria" : "Not provided")}
                      </p>
                      {selectedVendor.latitude !== null && selectedVendor.longitude !== null ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Saved pin: {selectedVendor.latitude.toFixed(6)}, {selectedVendor.longitude.toFixed(6)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mb-2 text-sm text-slate-600">
                    {selectedVendor.id === "student-cafe"
                      ? "Click the confirmed cafeteria location on the map, or drag its pin, then save."
                      : "Click the confirmed collection point on the map, or drag its pin, then save."}
                  </p>
                  <CampusVendorMap
                    vendors={vendors}
                    editable
                    selectedVendorId={selectedVendor.id}
                    draftLocation={selectedDraft?.latitude.trim() && selectedDraft.longitude.trim()
                      ? { latitude: Number(selectedDraft.latitude), longitude: Number(selectedDraft.longitude) }
                      : null}
                    onSelectVendor={(vendorId) => {
                      setSelectedVendorId(vendorId);
                      setError("");
                      setMessage("");
                    }}
                    onPickLocation={pickLocation}
                  />
                  <div className="max-w-xl space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm font-medium text-slate-800">
                        Latitude
                        <input
                          type="number"
                          step="any"
                          min="-90"
                          max="90"
                          value={selectedDraft?.latitude ?? selectedVendor.latitude?.toString() ?? ""}
                          onChange={(event) => updateCoordinate("latitude", event.target.value)}
                          placeholder="e.g. -25.5404911"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium text-slate-800">
                        Longitude
                        <input
                          type="number"
                          step="any"
                          min="-180"
                          max="180"
                          value={selectedDraft?.longitude ?? selectedVendor.longitude?.toString() ?? ""}
                          onChange={(event) => updateCoordinate("longitude", event.target.value)}
                          placeholder="e.g. 28.0945182"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                    </div>
                    <p className="text-sm text-slate-600">Use coordinates confirmed at the vendor collection point. The server rejects coordinates outside the TUT Soshanguve South campus boundary.</p>
                    <button
                      type="button"
                      onClick={() => void saveLocation()}
                      disabled={!selectedDraft || isSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save aria-hidden="true" size={16} /> {isSaving ? "Saving..." : "Save coordinates"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export function VendorLocationsManager() {
  return (
    <RequireAuth role="admin">
      <VendorLocationsContent />
    </RequireAuth>
  );
}