"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { readAuthIdentity } from "@/lib/auth-session";

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
      <LoginForm />
    </AuthLayout>
  );
}
