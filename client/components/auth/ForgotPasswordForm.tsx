"use client";

import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/api";
import { validateEmail } from "@/lib/validations";
import { AuthInput } from "@/components/auth/AuthInput";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      setSuccess("");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await requestPasswordReset(email);
      setSuccess(response.message || "A reset link has been prepared for your account.");
    } catch (exc) {
      setSuccess("");
      setError(exc instanceof Error ? exc.message : "Unable to send a reset link right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="mb-6 flex items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <Mail className="h-5 w-5" />
        </div>
      </div>

      <div className="mb-6 text-center">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">Forgot your password?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email address and we’ll help you reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AuthInput
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email address"
          value={email}
          error={error}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
            setSuccess("");
          }}
        />

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-violet-400"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending reset link...
            </>
          ) : (
            "Send Reset Link"
          )}
        </button>

        <div className="text-center">
          <Link href="/login" className="text-sm font-medium text-violet-700 hover:text-violet-800">
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}
