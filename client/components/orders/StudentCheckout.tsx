"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  createStudentOrder,
  getCollectionSlots,
  getMenuItems,
  getStudentOrders,
  type ApiOrder,
  type CollectionSlot,
  type MenuApiItem,
} from "@/lib/api";

const SERVICE_FEE_CENTS = 500;
const DISCOUNT_PERCENT = 20;

type PaymentFormState = {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
};

type PaymentErrors = Partial<Record<keyof PaymentFormState, string>>;

const EMPTY_PAYMENT_FORM: PaymentFormState = {
  cardholderName: "",
  cardNumber: "",
  expiry: "",
  cvv: "",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

function formatSlot(startsAt: string) {
  return new Date(startsAt).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sanitizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string) {
  const digits = sanitizeDigits(value).slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = sanitizeDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCvv(value: string) {
  return sanitizeDigits(value).slice(0, 4);
}

function paymentInputClasses(error?: string) {
  return `mt-1 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 transition ${
    error ? "border-red-300 bg-red-50" : "border-slate-300 bg-white hover:border-violet-300 focus:border-violet-400 focus:outline-none"
  }`;
}

function validatePaymentForm(form: PaymentFormState): PaymentErrors {
  const errors: PaymentErrors = {};
  const digits = sanitizeDigits(form.cardNumber);

  if (!form.cardholderName.trim()) {
    errors.cardholderName = "Cardholder name is required.";
  }

  if (digits.length < 15 || digits.length > 19) {
    errors.cardNumber = "Enter a valid card number.";
  }

  if (!/^\d{2}\/\d{2}$/.test(form.expiry)) {
    errors.expiry = "Use MM/YY.";
  } else {
    const [monthText, yearText] = form.expiry.split("/");
    const month = Number(monthText);
    const year = Number(yearText);
    const thisYear = new Date().getFullYear() % 100;
    const thisMonth = new Date().getMonth() + 1;

    if (month < 1 || month > 12 || year < thisYear || (year === thisYear && month < thisMonth)) {
      errors.expiry = "Card expiry must be in the future.";
    }
  }

  if (form.cvv.length < 3 || form.cvv.length > 4) {
    errors.cvv = "CVV must be 3 or 4 digits.";
  }

  return errors;
}

export function StudentCheckout({ initialVendorId = "", initialItemId = "" }: {
  initialVendorId?: string;
  initialItemId?: string;
}) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuApiItem[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState(initialVendorId);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<CollectionSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [isSlotsLoading, setIsSlotsLoading] = useState(true);
  const [isEligibilityLoading, setIsEligibilityLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstOrderDiscountEligible, setFirstOrderDiscountEligible] = useState(false);
  const [error, setError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<ApiOrder | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(EMPTY_PAYMENT_FORM);
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});

  const handlePaymentFieldChange = (field: keyof PaymentFormState, value: string) => {
    const formattedValue = field === "cardNumber"
      ? formatCardNumber(value)
      : field === "expiry"
        ? formatExpiry(value)
        : field === "cvv"
          ? formatCvv(value)
          : value;

    setPaymentForm((current) => ({ ...current, [field]: formattedValue }));
    setPaymentErrors((current) => ({ ...current, [field]: undefined }));
    setError("");
  };

  useEffect(() => {
    let isCurrent = true;
    void getMenuItems().then((response) => {
      if (!isCurrent) return;
      setMenuItems(response.items);
      const nextVendorId = response.items.some((item) => item.vendorId === initialVendorId)
        ? initialVendorId
        : response.items[0]?.vendorId ?? "";
      setSelectedVendorId(nextVendorId);
      if (initialItemId && response.items.some((item) => item.id === initialItemId && item.vendorId === nextVendorId)) {
        setQuantities({ [initialItemId]: 1 });
      }
      setIsMenuLoading(false);
    }).catch((requestError: unknown) => {
      if (!isCurrent) return;
      setError(requestError instanceof Error ? requestError.message : "Unable to load the menu.");
      setIsMenuLoading(false);
    });
    return () => { isCurrent = false; };
  }, [initialItemId, initialVendorId]);

  useEffect(() => {
    let isCurrent = true;
    if (!selectedVendorId) {
      return () => { isCurrent = false; };
    }
    void getCollectionSlots(selectedVendorId).then((response) => {
      if (!isCurrent) return;
      setSlots(response.slots);
      setSelectedSlotId((current) => response.slots.some((slot) => slot.id === current)
        ? current
        : response.slots[0]?.id ?? "");
      setIsSlotsLoading(false);
    }).catch((requestError: unknown) => {
      if (!isCurrent) return;
      setError(requestError instanceof Error ? requestError.message : "Unable to load collection times.");
      setSlots([]);
      setIsSlotsLoading(false);
    });
    return () => { isCurrent = false; };
  }, [selectedVendorId]);

  useEffect(() => {
    let isCurrent = true;
    void getStudentOrders().then((response) => {
      if (!isCurrent) return;
      setFirstOrderDiscountEligible(response.firstOrderDiscountEligible);
      setIsEligibilityLoading(false);
    }).catch((requestError: unknown) => {
      if (!isCurrent) return;
      setError(requestError instanceof Error ? requestError.message : "Sign in to place an order.");
      setIsEligibilityLoading(false);
    });
    return () => { isCurrent = false; };
  }, []);

  const vendorOptions = useMemo(
    () => Array.from(new Map(menuItems.map((item) => [item.vendorId, item.vendor])).entries()),
    [menuItems],
  );
  const vendorItems = menuItems.filter((item) => item.vendorId === selectedVendorId);
  const selectedItems = vendorItems
    .filter((item) => (quantities[item.id] ?? 0) > 0)
    .map((item) => ({ ...item, quantity: quantities[item.id] }));
  const subtotalCents = selectedItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const discountCents = firstOrderDiscountEligible
    ? Math.round((subtotalCents * DISCOUNT_PERCENT) / 100)
    : 0;
  const totalCents = subtotalCents - discountCents + SERVICE_FEE_CENTS;

  const changeQuantity = (itemId: string, change: number) => {
    idempotencyKey.current = null;
    setQuantities((current) => {
      const quantity = Math.max(0, Math.min(20, (current[itemId] ?? 0) + change));
      const next = { ...current };
      if (quantity === 0) delete next[itemId];
      else next[itemId] = quantity;
      return next;
    });
    setPlacedOrder(null);
    setError("");
  };

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setQuantities({});
    setSlots([]);
    setSelectedSlotId("");
    setPaymentForm(EMPTY_PAYMENT_FORM);
    setPaymentErrors({});
    setIsSlotsLoading(true);
    idempotencyKey.current = null;
    setPlacedOrder(null);
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0 || !selectedSlotId || isEligibilityLoading) return;

    const validationErrors = validatePaymentForm(paymentForm);
    if (Object.keys(validationErrors).length > 0) {
      setPaymentErrors(validationErrors);
      setError("Please check the card details before confirming your order.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setPaymentErrors({});
    idempotencyKey.current ??= window.crypto.randomUUID();
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await createStudentOrder({
        items: selectedItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
        collectionSlotId: selectedSlotId,
        idempotencyKey: idempotencyKey.current,
      });
      setPlacedOrder(response.order);
      setFirstOrderDiscountEligible(false);
      setPaymentForm(EMPTY_PAYMENT_FORM);
      idempotencyKey.current = null;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to place your order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      role="student"
      title="Create Order"
      subtitle={isEligibilityLoading
        ? "Checking first-order discount eligibility."
        : firstOrderDiscountEligible
          ? "Your first order gets 20% off food items."
          : "Choose available items and a collection time."}
    >
      {placedOrder ? (
        <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-xl font-semibold text-emerald-900">Order placed</h2>
          <p className="mt-2 text-sm text-emerald-800">
            Order {placedOrder.id} is confirmed. {placedOrder.discountCents > 0
              ? `Your first-order discount of ${formatMoney(placedOrder.discountCents)} was applied.`
              : `Your total is ${formatMoney(placedOrder.totalCents)}.`}
          </p>
          <button
            type="button"
            onClick={() => router.push("/student/orders")}
            className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Track order
          </button>
        </section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Order items</h2>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Vendor
                <select
                  value={selectedVendorId}
                  onChange={(event) => handleVendorChange(event.target.value)}
                  disabled={isMenuLoading}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-slate-800"
                >
                  {vendorOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            </div>

            {isMenuLoading ? <p className="py-8 text-sm text-slate-500">Loading available items...</p> : null}
            {!isMenuLoading && vendorItems.length === 0 ? (
              <p className="py-8 text-sm text-slate-600">No available items from this vendor right now.</p>
            ) : null}
            <div className="mt-4 space-y-3">
              {vendorItems.map((item) => {
                const quantity = quantities[item.id] ?? 0;
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="min-w-[140px] flex-1">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-600">{item.description}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{formatMoney(item.priceCents)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => changeQuantity(item.id, -1)}
                        disabled={quantity === 0}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 disabled:opacity-40"
                      ><Minus className="h-4 w-4" /></button>
                      <span className="w-6 text-center text-sm tabular-nums">{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => changeQuantity(item.id, 1)}
                        disabled={quantity >= 20}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 disabled:opacity-40"
                      ><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-semibold text-slate-900">Checkout</h2>
            <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="collection-slot">
              Collection time
            </label>
            <select
              id="collection-slot"
              value={selectedSlotId}
              onChange={(event) => {
                idempotencyKey.current = null;
                setSelectedSlotId(event.target.value);
              }}
              disabled={isSlotsLoading || slots.length === 0}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
            >
              {isSlotsLoading ? <option value="">Loading collection times...</option> : null}
              {!isSlotsLoading && slots.length === 0 ? <option value="">No times available</option> : null}
              {slots.map((slot) => <option key={slot.id} value={slot.id}>{formatSlot(slot.startsAt)}</option>)}
            </select>

            {firstOrderDiscountEligible && !isEligibilityLoading ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Your first order gets 20% off food items. Service fees are not discounted.
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-violet-700">Payment</h3>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-violet-800">
                  Secure checkout
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="cardholder-name" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Cardholder name</label>
                  <input
                    id="cardholder-name"
                    value={paymentForm.cardholderName}
                    onChange={(event) => handlePaymentFieldChange("cardholderName", event.target.value)}
                    placeholder="Jane Student"
                    className={paymentInputClasses(paymentErrors.cardholderName)}
                  />
                  {paymentErrors.cardholderName ? <p className="mt-1 text-xs text-red-600">{paymentErrors.cardholderName}</p> : null}
                </div>
                <div>
                  <label htmlFor="card-number" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Card number</label>
                  <input
                    id="card-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={paymentForm.cardNumber}
                    onChange={(event) => handlePaymentFieldChange("cardNumber", event.target.value)}
                    placeholder="1234 5678 9012 3456"
                    className={paymentInputClasses(paymentErrors.cardNumber)}
                  />
                  {paymentErrors.cardNumber ? <p className="mt-1 text-xs text-red-600">{paymentErrors.cardNumber}</p> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="card-expiry" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Expiry</label>
                    <input
                      id="card-expiry"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      value={paymentForm.expiry}
                      onChange={(event) => handlePaymentFieldChange("expiry", event.target.value)}
                      placeholder="MM/YY"
                      className={paymentInputClasses(paymentErrors.expiry)}
                    />
                    {paymentErrors.expiry ? <p className="mt-1 text-xs text-red-600">{paymentErrors.expiry}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="card-cvv" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">CVV</label>
                    <input
                      id="card-cvv"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={paymentForm.cvv}
                      onChange={(event) => handlePaymentFieldChange("cvv", event.target.value)}
                      placeholder="123"
                      className={paymentInputClasses(paymentErrors.cvv)}
                    />
                    {paymentErrors.cvv ? <p className="mt-1 text-xs text-red-600">{paymentErrors.cvv}</p> : null}
                  </div>
                </div>
              </div>
            </div>

            <dl className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between gap-3"><dt>Food subtotal</dt><dd>{formatMoney(subtotalCents)}</dd></div>
              {firstOrderDiscountEligible ? (
                <div className="flex justify-between gap-3 text-emerald-700"><dt>First-order discount (20%)</dt><dd>-{formatMoney(discountCents)}</dd></div>
              ) : null}
              <div className="flex justify-between gap-3"><dt>Service fee</dt><dd>{formatMoney(SERVICE_FEE_CENTS)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base font-semibold text-slate-900"><dt>Total</dt><dd>{formatMoney(totalCents)}</dd></div>
            </dl>

            {isEligibilityLoading ? <p className="mt-3 text-xs text-slate-500">Checking first-order eligibility...</p> : null}
            {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isEligibilityLoading || isMenuLoading || isSlotsLoading || !selectedItems.length || !selectedSlotId}
              className="mt-5 w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Authorising card..." : "Pay and place order"}
            </button>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}