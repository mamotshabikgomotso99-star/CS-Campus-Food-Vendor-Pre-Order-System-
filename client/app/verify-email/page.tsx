import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<p className="py-8 text-center text-sm text-slate-600">Loading verification link...</p>}>
        <VerifyEmailForm />
      </Suspense>
    </AuthLayout>
  );
}
