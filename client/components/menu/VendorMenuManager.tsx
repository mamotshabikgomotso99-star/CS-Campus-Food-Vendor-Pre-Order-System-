"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Pencil, Plus, Search, Store, Trash2, UtensilsCrossed, X } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  createVendorMenuItem,
  getVendorMenuItems,
  removeVendorMenuItem,
  resolveApiUrl,
  updateVendorMenuItem,
  type MenuApiItem,
} from "@/lib/api";

type MenuForm = {
  name: string;
  category: string;
  description: string;
  price: string;
  available: boolean;
};

const emptyForm: MenuForm = {
  name: "",
  category: "",
  description: "",
  price: "",
  available: true,
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

function readImagePreview(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to preview this image."));
    });
    reader.addEventListener("error", () => reject(new Error("Unable to preview this image.")));
    reader.readAsDataURL(file);
  });
}

export function VendorMenuManager() {
  const [items, setItems] = useState<MenuApiItem[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuApiItem | null>(null);
  const [form, setForm] = useState<MenuForm>(emptyForm);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState("");
  const [pendingRemove, setPendingRemove] = useState<MenuApiItem | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isCurrent = true;
    void getVendorMenuItems().then((response) => {
      if (isCurrent) setItems(response.items);
    }).catch((requestError: unknown) => {
      if (isCurrent) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load your menu.");
        setItems([]);
      }
    });
    return () => { isCurrent = false; };
  }, []);

  const visibleItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return (items ?? []).filter((item) =>
      [item.name, item.category, item.description].some((value) => value.toLowerCase().includes(query)),
    );
  }, [items, searchTerm]);

  const openAddForm = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setSelectedImage(null);
    setImagePreview(null);
    setRemoveExistingImage(false);
    setError("");
    setMessage("");
    setIsFormOpen(true);
  };

  const openEditForm = (item: MenuApiItem) => {
    setEditingItem(item);
    setSelectedImage(null);
    setImagePreview(null);
    setRemoveExistingImage(false);
    setForm({
      name: item.name,
      category: item.category,
      description: item.description,
      price: (item.priceCents / 100).toFixed(2),
      available: item.available,
    });
    setError("");
    setMessage("");
    setIsFormOpen(true);
  };

  const updateForm = <K extends keyof MenuForm>(key: K, value: MenuForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setMessage("");
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setSelectedImage(null);
    setImagePreview(null);
    setRemoveExistingImage(false);
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Choose an image smaller than 2 MB.");
      return;
    }

    try {
      setImagePreview(await readImagePreview(file));
      setSelectedImage(file);
      setRemoveExistingImage(false);
      setError("");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Unable to preview this image.");
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPrice = form.price.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(cleanPrice)) {
      setError("Enter a price with no more than two decimal places.");
      return;
    }
    const priceCents = Math.round(Number(cleanPrice) * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 1_000_000) {
      setError("Price must be between R 0.01 and R 10,000.00.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      priceCents,
      available: form.available,
    };
    if (!payload.name || !payload.category || payload.name.length > 100 || payload.category.length > 80 || payload.description.length > 300) {
      setError("Enter a name and category. Keep the name under 100 characters, category under 80, and description under 300.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingItem) {
        const response = await updateVendorMenuItem(editingItem.id, payload, selectedImage, removeExistingImage);
        setItems((current) => current?.map((item) => item.id === response.item.id ? response.item : item) ?? [response.item]);
        setMessage("Menu item updated.");
      } else {
        const response = await createVendorMenuItem(payload, selectedImage);
        setItems((current) => [...(current ?? []), response.item].sort((left, right) => left.name.localeCompare(right.name)));
        setMessage("Menu item added.");
      }
      setIsFormOpen(false);
      setEditingItem(null);
      setForm(emptyForm);
      setSelectedImage(null);
      setImagePreview(null);
      setRemoveExistingImage(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save this menu item.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (item: MenuApiItem) => {
    setDeletingItemId(item.id);
    setError("");
    setMessage("");
    try {
      const response = await removeVendorMenuItem(item.id);
      setItems((current) => current?.filter((currentItem) => currentItem.id !== item.id) ?? []);
      setMessage(response.message);
      setPendingRemove(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to remove this menu item.");
    } finally {
      setDeletingItemId("");
    }
  };

  return (
    <DashboardLayout
      role="vendor"
      title="Manage Menu"
      subtitle="Update your dishes, prices, and availability. Changes to available items appear in student checkout."
    >
      <section className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <span className="sr-only">Search menu items</span>
            <input
              type="search"
              placeholder="Search menu items"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add item
          </button>
        </div>

        {error && !isFormOpen ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message && !isFormOpen ? <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}

        {pendingRemove ? (
          <div role="alertdialog" aria-labelledby="remove-menu-item-title" className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="remove-menu-item-title" className="font-semibold text-red-900">Remove {pendingRemove.name}?</h2>
              <p className="mt-1 text-sm text-red-800">If this item is in order history, it will be marked unavailable instead of deleted.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setPendingRemove(null)} disabled={Boolean(deletingItemId)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Keep item</button>
              <button type="button" onClick={() => void handleRemove(pendingRemove)} disabled={Boolean(deletingItemId)} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
                {deletingItemId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove item
              </button>
            </div>
          </div>
        ) : null}

        {isFormOpen ? (
          <form onSubmit={handleSave} className="mt-5 rounded-xl border border-violet-200 bg-violet-50/60 p-4" aria-label={editingItem ? "Edit menu item" : "Add menu item"}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{editingItem ? "Edit menu item" : "Add menu item"}</h2>
              <button type="button" onClick={() => { setIsFormOpen(false); setError(""); }} aria-label="Close menu form" className="rounded-lg p-2 text-slate-600 hover:bg-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Item name
                <input required maxLength={100} value={form.name} onChange={(event) => updateForm("name", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Category
                <input required maxLength={80} value={form.category} onChange={(event) => updateForm("category", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Price (ZAR)
                <input required type="number" min="0.01" max="10000" step="0.01" value={form.price} onChange={(event) => updateForm("price", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Description
                <textarea maxLength={300} rows={3} value={form.description} onChange={(event) => updateForm("description", event.target.value)} className="resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
              </label>
              <div className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                <label htmlFor="menu-item-image">Picture</label>
                <input
                  id="menu-item-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:font-medium file:text-violet-800"
                  aria-describedby="menu-item-image-help"
                />
                <p id="menu-item-image-help" className="text-xs font-normal text-slate-500">JPEG, PNG, or WebP up to 2 MB.</p>
                {imagePreview || (editingItem?.imageUrl && !removeExistingImage) ? (
                  <div className="flex flex-wrap items-start gap-3">
                    <img
                      src={imagePreview ?? resolveApiUrl(editingItem?.imageUrl ?? "")}
                      alt="Menu item picture preview"
                      className="h-24 w-32 rounded-lg border border-slate-200 object-cover"
                    />
                    {editingItem?.imageUrl && !removeExistingImage ? (
                      <button
                        type="button"
                        onClick={() => { setRemoveExistingImage(true); setSelectedImage(null); setImagePreview(null); }}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Remove current picture
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {removeExistingImage ? <p className="text-xs text-slate-600">Current picture will be removed when you save.</p> : null}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input type="checkbox" checked={form.available} onChange={(event) => updateForm("available", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500" />
                Available to students
              </label>
            </div>
            {error ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setIsFormOpen(false); setError(""); }} disabled={isSaving} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60">
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isSaving ? "Saving..." : editingItem ? "Save changes" : "Add item"}
              </button>
            </div>
          </form>
        ) : null}

        {items === null ? <p className="py-8 text-center text-sm text-slate-500">Loading your menu...</p> : null}
        {items?.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
            <Store className="mx-auto h-8 w-8 text-violet-600" aria-hidden="true" />
            <p className="mt-3 font-medium text-slate-900">Your menu is empty</p>
            <p className="mt-1 text-sm text-slate-600">Add an item to make it available for student orders.</p>
          </div>
        ) : null}
        {items && items.length > 0 && visibleItems.length === 0 ? <p className="py-8 text-center text-sm text-slate-600">No menu items match that search.</p> : null}

        {visibleItems.length > 0 ? (
          <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200">
            {visibleItems.map((item) => (
              <article key={item.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {item.imageUrl ? (
                    <img src={resolveApiUrl(item.imageUrl)} alt={item.name} className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                      <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">{item.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">{item.category} · {formatMoney(item.priceCents)}</p>
                    {item.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.description}</p> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={["rounded-full px-2.5 py-1 text-xs font-medium", item.available ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"].join(" ")}>
                    {item.available ? "Available" : "Unavailable"}
                  </span>
                  <button type="button" onClick={() => openEditForm(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-violet-300 hover:text-violet-700">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button type="button" onClick={() => setPendingRemove(item)} disabled={Boolean(deletingItemId)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </DashboardLayout>
  );
}