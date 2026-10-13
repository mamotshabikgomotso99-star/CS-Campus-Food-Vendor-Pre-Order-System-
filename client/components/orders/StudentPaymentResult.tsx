"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { getStudentPayment, type ApiOrder } from "@/lib/api";

type PaymentResult = {
  paymentStatus: ApiOrder["paymentStatus"];
  checkoutUrl: string | null;
  order: ApiOrder;
};

export function StudentPaymentResult({ paymentId, cancelled }: { paymentId: string; cancelled: boolean }) {
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    let attempts = 0;
    let timer: number | undefined;

    const checkPayment = async () => {
      try {
        const response = await getStudentPayment(paymentId);
        if (!isCurrent) return;
        setResult(response);
        setError("");
        if (response.paymentStatus === "pending" && attempts < 20) {
          attempts += 1;
          timer = window.setTimeout(checkPayment, 2500);
        }
      } catch (requestError) {
        if (isCurrent) {
          setError(requestError instanceof Error ? requestError.message : "Unable to verify this payment.");
        }
      }
    };

    if (paymentId) void checkPayment();

    return () => {
      isCurrent = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [paymentId]);

  const paymentStatus = result?.paymentStatus;
  const isPaid = paymentStatus === "paid";
  const hasEnded = paymentStatus === "expired" || paymentStatus === "failed";
  const displayError = paymentId ? error : "Payment reference is missing.";

  return (
    <DashboardLayout
      role="student"
      title="Payment status"
      subtitle="Payment confirmation comes from Stripe, not the return page."
    >
      <section className="max-w-2xl rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900">
          {isPaid ? "Payment confirmed" : hasEnded ? "Payment not completed" : cancelled ? "Checkout was cancelled" : "Verifying payment"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {isPaid
            ? `Order ${result?.order.id ?? ""} is paid and waiting for vendor confirmation.`
            : hasEnded
              ? "This payment session ended. Return to checkout to place a new order."
              : cancelled
                ? "Your order is not paid yet. You can continue the open Stripe checkout or return to your orders."
                : "Stripe is confirming your payment. This page will update when the server receives its signed notification."}
        </p>

        {result ? (
          <dl className="mt-5 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Order</dt><dd className="mt-1 font-semibold text-slate-900">{result.order.id}</dd></div>
            <div><dt className="text-slate-500">Payment</dt><dd className="mt-1 font-semibold capitalize text-slate-900">{result.paymentStatus}</dd></div>
            <div><dt className="text-slate-500">Vendor</dt><dd className="mt-1 font-semibold text-slate-900">{result.order.vendor}</dd></div>
            <div><dt className="text-slate-500">Total</dt><dd className="mt-1 font-semibold text-slate-900">{new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(result.order.totalCents / 100)}</dd></div>
          </dl>
        ) : null}

        {displayError ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{displayError}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {result?.checkoutUrl && !isPaid ? (
            <a href={result.checkoutUrl} className="inline-flex items-center justify-center rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">
              Continue payment
            </a>
          ) : null}
          {hasEnded ? (
            <Link href="/student/vendors" className="inline-flex items-center justify-center rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">
              Start a new order
            </Link>
          ) : null}
          <Link href="/student/orders" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            View my orders
          </Link>
        </div>
      </section>
    </DashboardLayout>
  );
}