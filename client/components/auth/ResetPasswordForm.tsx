"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { resetPassword } from "@/lib/api";
import { validatePassword } from "@/lib/validations";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function ResetPasswordForm({ token }: { token: string }) {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const passwordError = validatePassword(form.password);
    if (!token || passwordError || form.password !== form.confirmPassword) {
      setError(!token
        ? "This reset link is missing or invalid. Request a new link to continue."
        : passwordError || "Passwords do not match.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await resetPassword({ token, password: form.password, confirmPassword: form.confirmPassword });
      setSuccess(response.message || "Your password was updated successfully.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset your password right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">Reset your password</h1>
          <p className="mt-2 text-sm text-slate-600">Create a new password for your account.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <PasswordInput label="New password" name="password" autoComplete="new-password" placeholder="Enter your new password" value={form.password} error={error.startsWith("Password") ? error : ""} onChange={(event) => updateField("password", event.target.value)} />
          <AuthInput label="Confirm password" type="password" name="confirmPassword" autoComplete="new-password" placeholder="Confirm your new password" value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} />
          {success ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          {error && !error.startsWith("Password") ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <button type="submit" disabled={isSubmitting || Boolean(success)} className="flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-violet-400">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating password...</> : "Reset Password"}
          </button>
          <div className="text-center"><Link href="/login" className="text-sm font-medium text-violet-700 hover:text-violet-800">Back to Login</Link></div>
        </form>
      </div>
    </div>
  );
}