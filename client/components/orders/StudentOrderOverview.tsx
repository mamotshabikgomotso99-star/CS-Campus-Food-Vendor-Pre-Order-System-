"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Clock3, Coffee, Store } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getStudentOrders, type ApiOrder } from "@/lib/api";

const statIcons = [Store, BadgeCheck, Coffee, Clock3];

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

export function StudentOrderOverview() {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
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
    const intervalId = window.setInterval(loadOrders, 15_000);
    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const loadedOrders = orders ?? [];
  const activeOrders = loadedOrders.filter((order) => !["Collected", "Cancelled"].includes(order.status));
  const completedOrders = loadedOrders.filter((order) => order.status === "Collected");
  const pendingOrders = loadedOrders.filter((order) => order.status === "Pending");
  const stats = [
    { label: "Active Orders", value: orders ? String(activeOrders.length) : "—", hint: orders && activeOrders.length ? `Across ${new Set(activeOrders.map((order) => order.vendor)).size} vendors` : "No orders yet" },
    { label: "Completed Orders", value: orders ? String(completedOrders.length) : "—", hint: completedOrders.length ? "Collected orders" : "None completed yet" },
    { label: "Available Vendors", value: "9", hint: "Open now" },
    { label: "Pending Orders", value: orders ? String(pendingOrders.length) : "—", hint: pendingOrders.length ? "Need attention" : "No pending orders" },
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
          <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-900">Recent Orders</h3>
          <Link href="/student/orders" className="text-sm font-medium text-violet-700 hover:text-violet-800">View details</Link>
        </div>
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {!orders && !error ? <p className="py-6 text-sm text-slate-500">Loading your orders...</p> : null}
        {orders?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 pr-4 font-medium">Order ID</th><th className="pb-3 pr-4 font-medium">Vendor</th><th className="pb-3 pr-4 font-medium">Items</th><th className="pb-3 pr-4 font-medium">Total</th><th className="pb-3 pr-4 font-medium">Collection</th><th className="pb-3 pr-4 font-medium">Status</th>
              </tr></thead>
              <tbody>{orders.slice(0, 5).map((order) => (
                <tr key={order.orderId} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 pr-4 font-medium text-slate-800">{order.id}</td><td className="py-3 pr-4 text-slate-600">{order.vendor}</td><td className="py-3 pr-4 text-slate-600">{order.items}</td><td className="py-3 pr-4 font-medium text-slate-800">{formatMoney(order.totalCents)}</td><td className="py-3 pr-4 text-slate-600">{new Date(order.collectionAt).toLocaleString()}</td><td className="py-3 pr-4"><StatusBadge status={order.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
        {orders && orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <p className="font-medium text-slate-900">No orders yet</p>
            <p className="mt-1 text-sm text-slate-600">Your recent orders will appear here after you place one.</p>
            <Link href="/student/vendors" className="mt-4 inline-flex text-sm font-semibold text-violet-700 hover:text-violet-800">Browse vendors</Link>
          </div>
        ) : null}
      </section>
    </>
  );
}