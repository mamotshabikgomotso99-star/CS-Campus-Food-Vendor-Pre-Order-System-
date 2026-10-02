"use client";

import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { verifyEmail } from "@/lib/api";

export function VerifyEmailForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleResend = async () => {
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await verifyEmail("student@campus.edu");
      setSuccess(response.message || "Verification mail sent successfully.");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Unable to resend the verification email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="mb-6 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <MailCheck className="h-6 w-6" />
        </div>
      </div>

      <div className="mb-6 text-center">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">Verify your email</h2>
        <p className="mt-2 text-sm text-slate-600">
          Check your inbox and follow the verification link to activate your account.
        </p>
      </div>

      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleResend}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-violet-400"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending verification...
          </>
        ) : (
          "Resend verification"
        )}
      </button>

      <div className="mt-5 text-center">
        <Link href="/login" className="text-sm font-medium text-violet-700 hover:text-violet-800">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
