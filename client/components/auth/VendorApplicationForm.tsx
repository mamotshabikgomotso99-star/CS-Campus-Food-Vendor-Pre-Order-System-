"use client";

import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { submitVendorRequest } from "@/lib/api";
import { validateEmail, validateName, validatePassword } from "@/lib/validations";

type FormState = {
  fullName: string;
  email: string;
  vendorName: string;
  category: string;
  collectionLocation: string;
  openingTime: string;
  closingTime: string;
  preparationTimeMinutes: string;
  password: string;
  confirmPassword: string;
};

type FieldName = keyof FormState | "general";

export function VendorApplicationForm() {
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    vendorName: "",
    category: "",
    collectionLocation: "",
    openingTime: "",
    closingTime: "",
    preparationTimeMinutes: "30",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined, general: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Partial<Record<FieldName, string>> = {};
    const nameError = validateName(form.fullName, "full name");
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);
    const vendorNameError = validateName(form.vendorName, "business name");

    if (nameError) nextErrors.fullName = nameError;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (vendorNameError) nextErrors.vendorName = vendorNameError;

    if (!form.category.trim()) nextErrors.category = "Enter a business category.";
    if (!form.collectionLocation.trim()) nextErrors.collectionLocation = "Enter the campus collection point.";
    if (!form.openingTime) nextErrors.openingTime = "Enter an opening time.";

    if (!form.category.trim()) nextErrors.category = "Enter a business category.";
    if (!form.collectionLocation.trim()) nextErrors.collectionLocation = "Enter the campus collection point.";
    if (!form.openingTime) nextErrors.openingTime = "Enter an opening time.";
    if (!form.closingTime) nextErrors.closingTime = "Enter a closing time.";
    if (form.openingTime && form.closingTime && form.openingTime >= form.closingTime) {
      nextErrors.closingTime = "Closing time must be later than opening time.";
    }
    const preparationTimeMinutes = Number(form.preparationTimeMinutes);
    if (!Number.isInteger(preparationTimeMinutes) || preparationTimeMinutes < 1 || preparationTimeMinutes > 180) {
      nextErrors.preparationTimeMinutes = "Enter a preparation time from 1 to 180 minutes.";
    }
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await submitVendorRequest({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        vendorName: form.vendorName.trim(),
        category: form.category.trim(),
        collectionLocation: form.collectionLocation.trim(),
        openingTime: form.openingTime,
        closingTime: form.closingTime,
        preparationTimeMinutes,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setSubmitted(true);
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : "Unable to submit your request." });

    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-600">Request received</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Awaiting review</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Your application is with the Campus Eats admin team. You can sign in after it is approved.</p>
        <Link href="/login" className="mt-6 inline-flex font-semibold text-violet-700 hover:text-violet-800">Return to sign in</Link>
      </section>

    );
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-600">Vendor onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Request an account</h1>
        <p className="mt-2 text-sm text-slate-600">Vendor access is issued after an administrator reviews your application.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AuthInput label="Your full name" type="text" name="fullName" autoComplete="name" placeholder="Enter your full name" value={form.fullName} error={errors.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
        <AuthInput label="Email address" type="email" name="email" autoComplete="email" placeholder="Enter your email address" value={form.email} error={errors.email} onChange={(event) => updateField("email", event.target.value)} />
        <AuthInput label="Business name" type="text" name="vendorName" placeholder="Name of your campus business" value={form.vendorName} error={errors.vendorName} onChange={(event) => updateField("vendorName", event.target.value)} />
        <AuthInput label="Business category" type="text" name="category" placeholder="For example, meals or drinks" value={form.category} error={errors.category} onChange={(event) => updateField("category", event.target.value)} />
        <AuthInput label="Collection point" type="text" name="collectionLocation" placeholder="Campus location for order collection" value={form.collectionLocation} error={errors.collectionLocation} onChange={(event) => updateField("collectionLocation", event.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <AuthInput label="Opens" type="time" name="openingTime" value={form.openingTime} error={errors.openingTime} onChange={(event) => updateField("openingTime", event.target.value)} />
          <AuthInput label="Closes" type="time" name="closingTime" value={form.closingTime} error={errors.closingTime} onChange={(event) => updateField("closingTime", event.target.value)} />
        </div>
        <AuthInput label="Preparation time (minutes)" type="number" name="preparationTimeMinutes" min={1} max={180} value={form.preparationTimeMinutes} error={errors.preparationTimeMinutes} onChange={(event) => updateField("preparationTimeMinutes", event.target.value)} />
        <PasswordInput label="Password" name="password" autoComplete="new-password" placeholder="Create a password" value={form.password} error={errors.password} onChange={(event) => updateField("password", event.target.value)} />
        <AuthInput label="Confirm password" type="password" name="confirmPassword" autoComplete="new-password" placeholder="Confirm your password" value={form.confirmPassword} error={errors.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} />
        {errors.general ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errors.general}</div> : null}

        <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-violet-400">
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending request...</> : <><Send className="mr-2 h-4 w-4" />Submit for review</>}
        </button>
        <p className="text-center text-sm text-slate-600">Already approved? <Link href="/login" className="font-semibold text-violet-700 hover:text-violet-800">Sign in</Link></p>
      </form>
    </section>

  );
}