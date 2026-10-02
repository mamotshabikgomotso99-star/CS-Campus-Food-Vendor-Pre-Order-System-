"use client";

import { Check, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getVendorOrders, updateVendorOrderStatus, type ApiOrder } from "@/lib/api";

function formatCollection(collectionAt: string) {
  return new Date(collectionAt).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const nextStatuses: Record<ApiOrder["status"], ApiOrder["status"][]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Preparing", "Cancelled"],
  Preparing: ["Ready for Collection"],
  "Ready for Collection": ["Collected"],
  Collected: [],
  Cancelled: [],
};

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, ApiOrder["status"]>>({});
  const [updatedOrderId, setUpdatedOrderId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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

  const handleStatusChange = (orderId: string, status: ApiOrder["status"]) => {
    setDraftStatuses((previous) => ({ ...previous, [orderId]: status }));
    setUpdatedOrderId("");
  };

  const handleUpdate = async (orderId: string) => {
    const currentOrder = orders?.find((order) => order.id === orderId);
    const nextStatus =
      draftStatuses[orderId] ?? (currentOrder ? nextStatuses[currentOrder.status][0] : undefined);

    if (!nextStatus) {
      return;
    }

    setError("");
    try {
      const response = await updateVendorOrderStatus(orderId, nextStatus);
      setOrders((previous) => previous?.map((order) => order.orderId === response.order.orderId ? response.order : order) ?? []);
      setDraftStatuses((previous) => {
        const next = { ...previous };
        delete next[orderId];
        return next;
      });
      setUpdatedOrderId(orderId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update the order.");
    }
  };

  const visibleOrders = (orders ?? []).filter((order) => order.id.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  return (
    <DashboardLayout
      role="vendor"
      title="Order Management"
      subtitle="Review incoming orders and update collection status."
    >
      <section className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search order ID"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>

        {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {orders === null && !error ? <p className="py-6 text-sm text-slate-500">Loading incoming orders...</p> : null}
        {orders?.length === 0 && !error ? <p className="py-8 text-center text-sm text-slate-600">No incoming orders yet.</p> : null}

        {visibleOrders.length > 0 ? <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 pr-4 font-medium">Order ID</th>
                <th className="pb-3 pr-4 font-medium">Student</th>
                <th className="pb-3 pr-4 font-medium">Items</th>
                <th className="pb-3 pr-4 font-medium">Collection</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const availableStatuses = nextStatuses[order.status];
                const selectedStatus = draftStatuses[order.id] ?? availableStatuses[0];

                return (
                <tr key={order.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 pr-4 font-medium text-slate-800">{order.id}</td>
                  <td className="py-3 pr-4 text-slate-600">{order.student}</td>
                  <td className="py-3 pr-4 text-slate-600">{order.items}</td>
                  <td className="py-3 pr-4 text-slate-600">{formatCollection(order.collectionAt)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={order.status} /></td>
                  <td className="py-3 pr-4">
                    {availableStatuses.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`New status for ${order.id}`}
                          value={selectedStatus}
                          onChange={(event) => handleStatusChange(order.id, event.target.value as ApiOrder["status"])}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        >
                          {availableStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleUpdate(order.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#918FD0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#7F7DC0] disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Update
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Complete</span>
                    )}
                    {updatedOrderId === order.id ? (
                      <p className="mt-1 text-xs font-medium text-emerald-600">Status updated</p>
                    ) : null}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div> : null}
        {orders && orders.length > 0 && visibleOrders.length === 0 ? <p className="py-6 text-center text-sm text-slate-600">No orders match that search.</p> : null}
      </section>
    </DashboardLayout>
  );
}
