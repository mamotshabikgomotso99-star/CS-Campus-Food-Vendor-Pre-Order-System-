"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Clock3, ShoppingBag, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getVendorOrders, type ApiOrder } from "@/lib/api";

const statIcons = [UtensilsCrossed, BadgeCheck, Clock3, ShoppingBag];

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

function formatCollection(isoDate: string) {
  return new Date(isoDate).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function VendorOrderOverview() {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    const loadOrders = async () => {
      try {
        const response = await getVendorOrders();
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

  const pendingCount = orders?.filter((order) => order.status === "Pending").length;
  const readyCount = orders?.filter((order) => order.status === "Ready for Collection").length;
  const stats = [
    { label: "Total Menu Items", value: "24", hint: "Across all categories" },
    { label: "Available Items", value: "19", hint: "Ready to sell" },
    { label: "Pending Orders", value: pendingCount === undefined ? "—" : String(pendingCount), hint: pendingCount ? "Need attention" : "No pending orders" },
    { label: "Ready for Collection", value: readyCount === undefined ? "—" : String(readyCount), hint: readyCount ? "At pickup" : "No orders at pickup" },
  ];

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = statIcons[index % statIcons.length];
          return <StatCard key={stat.label} {...stat} icon={Icon} />;
        })}
      </section>

      <section className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-900">Incoming Orders</h3>
          <Link href="/vendor/orders" className="text-sm font-medium text-violet-700 hover:text-violet-800">View all</Link>
        </div>
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {!orders && !error ? <p className="py-6 text-sm text-slate-500">Loading incoming orders...</p> : null}
        {orders?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 pr-4 font-medium">Order ID</th><th className="pb-3 pr-4 font-medium">Student</th><th className="pb-3 pr-4 font-medium">Items</th><th className="pb-3 pr-4 font-medium">Collection</th><th className="pb-3 pr-4 font-medium">Total</th><th className="pb-3 pr-4 font-medium">Status</th>
              </tr></thead>
              <tbody>{orders.slice(0, 5).map((order) => (
                <tr key={order.orderId} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 pr-4 font-medium text-slate-800">{order.id}</td><td className="py-3 pr-4 text-slate-600">{order.student}</td><td className="py-3 pr-4 text-slate-600">{order.items}</td><td className="py-3 pr-4 text-slate-600">{formatCollection(order.collectionAt)}</td><td className="py-3 pr-4 font-medium text-slate-800">{formatMoney(order.totalCents)}</td><td className="py-3 pr-4"><StatusBadge status={order.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
        {orders?.length === 0 ? <p className="py-8 text-center text-sm text-slate-600">No incoming orders yet.</p> : null}
      </section>
    </>
  );
}