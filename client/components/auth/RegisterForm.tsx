"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { registerUser } from "@/lib/api";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/validations";

type FormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  studentNumber: string;
  termsAccepted: boolean;
};

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    studentNumber: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "general", string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined, general: undefined }));
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof FormState | "general", string>> = {};

    const fullNameError = validateName(form.fullName, "full name");
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);

    if (fullNameError) nextErrors.fullName = fullNameError;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (!form.termsAccepted) {
      nextErrors.termsAccepted = "Please accept the terms and conditions.";
    }

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
      await registerUser({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: "student",
        studentNumber: form.studentNumber.trim() || undefined,
      });

      router.push("/verify-email");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed. Please try again.";
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-600">Join us</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
          Create your account
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Join the campus food ordering community.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AuthInput
          label="Full name"
          type="text"
          name="fullName"
          autoComplete="name"
          placeholder="Enter your full name"
          value={form.fullName}
          error={errors.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
        />

        <AuthInput
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email address"
          value={form.email}
          error={errors.email}
          onChange={(event) => updateField("email", event.target.value)}
        />

        <AuthInput
          label="Student number (optional)"
          type="text"
          name="studentNumber"
          placeholder="Enter your student number"
          value={form.studentNumber}
          error={errors.studentNumber}
          onChange={(event) => updateField("studentNumber", event.target.value)}
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={form.password}
          error={errors.password}
          onChange={(event) => updateField("password", event.target.value)}
        />

        <AuthInput
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Confirm your password"
          value={form.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => updateField("confirmPassword", event.target.value)}
        />

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.termsAccepted}
            onChange={(event) => updateField("termsAccepted", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          />
          <span>
            I agree to the <span className="font-medium text-violet-700">terms and conditions</span>.
          </span>
        </label>
        {errors.termsAccepted ? (
          <p className="text-xs font-medium text-red-600">{errors.termsAccepted}</p>
        ) : null}

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
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already have an account? {" "}
          <Link href="/login" className="font-semibold text-violet-700 hover:text-violet-800">
            Log in
          </Link>
        </p>
      </form>

    </div>
  );
}
