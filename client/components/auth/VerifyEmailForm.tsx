"use client";

import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthInput } from "@/components/auth/AuthInput";
import { confirmEmail, verifyEmail } from "@/lib/api";
import { validateEmail } from "@/lib/validations";

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const initialEmail = searchParams.get("email") ?? "";
  const deliveryFailed = searchParams.get("delivery") === "failed";
  const handledToken = useRef("");
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState("");
  const [isConfirming, setIsConfirming] = useState(Boolean(token));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(deliveryFailed ? "The verification email could not be sent. Request another link below." : "");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!token || handledToken.current === token) {
      return;
    }
    handledToken.current = token;
    setError("");
    setSuccess("");
    void confirmEmail(token)
      .then((response) => setSuccess(response.message))
      .catch((exc) => setError(exc instanceof Error ? exc.message : "Unable to verify your email."))
      .finally(() => setIsConfirming(false));
  }, [token]);

  const handleResend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await verifyEmail(email.trim());
      setSuccess(response.message);
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
          {success.includes("Email verified")
            ? "Your account is ready. Sign in to continue."
            : "Confirm your address using the email link, or request another verification email."}
        </p>
      </div>

      {isConfirming ? (
        <p className="mb-4 text-center text-sm text-slate-600" role="status">Verifying your email...</p>
      ) : null}

      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {!success ? (
        <form onSubmit={handleResend} className="space-y-4">
          <AuthInput
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Enter your email address"
            value={email}
            error={emailError}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError("");
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting || isConfirming}
            className="flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-violet-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending verification...
              </>
            ) : (
              "Resend verification email"
            )}
          </button>
        </form>
      ) : null}

      <div className="mt-5 text-center">
        <Link href="/login" className="text-sm font-medium text-violet-700 hover:text-violet-800">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
