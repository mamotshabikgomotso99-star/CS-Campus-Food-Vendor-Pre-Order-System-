"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearAuthIdentity, saveAuthIdentity } from "@/lib/auth-session";
import { getCurrentUser } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    let isActive = true;

    void getCurrentUser()
      .then((response) => {
        const user = response.user;
        if (!isActive) return;
        if (!response.success || !user || !user.role) {
          throw new Error("Session check failed.");
        }

        saveAuthIdentity({
          fullName: user.fullName ?? user.email.split("@")[0],
          email: user.email,
          role: user.role,
        });
        router.replace(`/${user.role}/dashboard`);
      })
      .catch(() => {
        if (!isActive) return;
        clearAuthIdentity();
        router.replace("/login");
      });

    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
      <p className="text-sm font-medium text-violet-700">Opening your dashboard...</p>
    </div>
  );
}
