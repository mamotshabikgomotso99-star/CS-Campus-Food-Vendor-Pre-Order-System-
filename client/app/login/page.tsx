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
    if (identity?.role === "vendor" || identity?.role === "student") {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
