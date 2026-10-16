"use client";

import { useEffect } from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { readAuthIdentity } from "@/lib/auth-session";

function LoginFormWithNotice() {
  const searchParams = useSearchParams();
  const notice = searchParams.get("accountCreated") === "local"
    ? "Account created. Sign in with your new credentials."
    : "";

  return <LoginForm notice={notice} />;
}

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const identity = readAuthIdentity();
    if (identity) {
      router.replace(identity.role === "admin" ? "/admin/dashboard" : `/${identity.role}/dashboard`);
    }
  }, [router]);

  return (
    <AuthLayout>
      <Suspense fallback={<p className="py-8 text-center text-sm text-slate-600">Loading sign in...</p>}>
        <LoginFormWithNotice />
      </Suspense>
    </AuthLayout>
  );
}
