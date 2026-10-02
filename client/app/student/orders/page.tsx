"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getStudentOrders, type ApiOrder } from "@/lib/api";

const orderProgress: Array<{ label: string; statuses: string[] }> = [
  { label: "Order placed", statuses: ["Pending"] },
  { label: "Confirmed", statuses: ["Confirmed", "Preparing", "Ready for Collection", "Collected"] },
  { label: "Preparing", statuses: ["Preparing", "Ready for Collection", "Collected"] },
  { label: "Ready", statuses: ["Ready for Collection", "Collected"] },
  { label: "Collected", statuses: ["Collected"] },
];

export default function StudentOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    const loadOrders = async () => {
      try {
        const response = await getStudentOrders();
        if (isCurrent) {
          setOrders(response.orders);
          setError("");
        }
      } catch (requestError) {
        if (isCurrent) setError(requestError instanceof Error ? requestError.message : "Unable to load orders.");
      }
    };
    void loadOrders();
    const intervalId = window.setInterval(loadOrders, 10_000);
    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedOrder = useMemo(
    () => orders?.find((order) => order.id === selectedOrderId) ?? orders?.[0],
    [orders, selectedOrderId],
  );

  return (
    <DashboardLayout
      role="student"
      title="My Orders"
      subtitle="Track your pre-orders and collection times."
    >
      <section className="space-y-5">
        {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {orders === null && !error ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading your orders...</p> : null}
        {orders?.length === 0 && !error ? (
          <div className="rounded-[28px] border border-violet-100 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">No orders yet</h2>
            <p className="mt-2 text-sm text-slate-600">Once you place an order, you can track its status and collection time here.</p>
            <Link href="/student/vendors" className="mt-5 inline-flex items-center justify-center rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800">
              Browse vendors
            </Link>
          </div>
        ) : null}
        {orders && orders.length > 0 ? <>
        <div className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="space-y-4">
            {orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;

                return (
                  <div
                    key={order.id}
                    className={[
                      "rounded-[24px] border p-4 transition",
                      isSelected
                        ? "border-violet-300 bg-violet-50 shadow-sm"
                        : "border-slate-200 bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{order.id}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{order.vendor}</p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Items</p>
                        <p className="mt-1 text-sm text-slate-700">{order.items}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total</p>
                        <p className="mt-1 text-sm text-slate-700">{formatMoney(order.totalCents)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Collection</p>
                        <p className="mt-1 text-sm text-slate-700">{formatCollection(order.collectionAt)}</p>
                      </div>
                      <div className="md:text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className={[
                            "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition",
                            isSelected
                              ? "bg-violet-700 text-white shadow-sm"
                              : "bg-[#918FD0] text-white hover:bg-[#7F7DC0]",
                          ].join(" ")}
                        >
                          {isSelected ? "Viewing Order" : "View Order"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
        </div>

          {selectedOrder ? (
          <div className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-violet-700">Order Details</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                  {selectedOrder.id}
                </h3>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Vendor</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{selectedOrder.vendor}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{formatMoney(selectedOrder.totalCents)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Collection</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{formatCollection(selectedOrder.collectionAt)}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Items</p>
              <p className="mt-2 text-base text-slate-700">{selectedOrder.items}</p>
            </div>

            <dl className="mt-6 max-w-md space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between gap-4 text-slate-600"><dt>Food subtotal</dt><dd>{formatMoney(selectedOrder.subtotalCents)}</dd></div>
              {selectedOrder.discountCents > 0 ? <div className="flex justify-between gap-4 text-emerald-700"><dt>First-order discount</dt><dd>-{formatMoney(selectedOrder.discountCents)}</dd></div> : null}
              <div className="flex justify-between gap-4 text-slate-600"><dt>Service fee</dt><dd>{formatMoney(selectedOrder.serviceFeeCents)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 font-semibold text-slate-900"><dt>Total</dt><dd>{formatMoney(selectedOrder.totalCents)}</dd></div>
            </dl>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Order progress</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {orderProgress.map((step) => {
                  const isActive = step.statuses.includes(selectedOrder.status);

                  return (
                    <div
                      key={step.label}
                      className={[
                        "rounded-2xl border p-3 text-sm",
                        isActive
                          ? "border-violet-200 bg-violet-50 text-violet-800"
                          : "border-slate-200 bg-slate-50 text-slate-500",
                      ].join(" ")}
                    >
                      {step.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
        </> : null}
      </section>
    </DashboardLayout>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

function formatCollection(collectionAt: string) {
  return new Date(collectionAt).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
