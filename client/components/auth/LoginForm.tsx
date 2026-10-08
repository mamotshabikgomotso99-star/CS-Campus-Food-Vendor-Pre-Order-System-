"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { loginUser } from "@/lib/api";
import { saveAuthIdentity } from "@/lib/auth-session";
import {
  validateEmail,
  validatePassword,
  type AccountRole,
} from "@/lib/validations";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function LoginForm({ role = "student" }: { role?: AccountRole }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined, general: undefined }));
  };

  const validateForm = () => {
    const nextErrors: typeof errors = {};
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);

    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await loginUser({
        email: form.email,
        password: form.password,
        remember: form.remember,
      });

      if (response.role !== role) {
        const portalName = role === "vendor" ? "vendor" : "student";
        throw new Error(`This account is not registered for the ${portalName} portal.`);
      }

      const accountRole = role;
      saveAuthIdentity({
        fullName: response.user?.fullName?.trim() || form.email.split("@")[0],
        email: response.user?.email ?? form.email.trim(),
        role: accountRole,
      });
      const redirectPath = accountRole === "vendor" ? "/vendor/dashboard" : "/student/dashboard";
      router.push(redirectPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed. Please try again.";
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-600">
          Sign in
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
          {role === "vendor" ? "Vendor sign in" : "Welcome back!"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {role === "vendor" ? "Sign in to your vendor account." : "Sign in to your student account."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AuthInput
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email address"
          value={form.email}
          error={errors.email}
          onChange={(event) => handleChange("email", event.target.value)}
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          error={errors.password}
          onChange={(event) => handleChange("password", event.target.value)}
        />

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(event) => handleChange("remember", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            Remember me
          </label>

          <Link href="/forgot-password" className="font-medium text-violet-700 hover:text-violet-800">
            Forgot password?
          </Link>
        </div>

        {errors.general ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.general}
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
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>

        {role === "student" ? (
          <p className="text-center text-sm text-slate-600">
            Don&apos;t have an account? {" "}
            <Link href="/register" className="font-semibold text-violet-700 hover:text-violet-800">
              Sign up
            </Link>
          </p>
        ) : null}
      </form>

      {role === "student" ? (
        <Link
          href="/vendor/login"
          className="fixed bottom-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white/70 px-2.5 py-1.5 text-[11px] font-medium text-violet-700 shadow-[0_4px_12px_rgba(124,58,237,0.06)] backdrop-blur-sm transition hover:border-violet-200 hover:bg-white hover:text-violet-800"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-50 text-[9px] leading-none text-violet-700">
            V
          </span>
          Vendor
        </Link>
      ) : null}
    </div>
  );
}
