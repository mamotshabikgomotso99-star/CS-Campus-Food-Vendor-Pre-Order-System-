"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { getCurrentUser, type AuthRole } from "@/lib/api";
import { clearAuthIdentity, readAuthIdentity, saveAuthIdentity } from "@/lib/auth-session";

export function RequireAuth({
  role,
  children,
}: {
  role?: AuthRole;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    const verifySession = async () => {
      const localIdentity = readAuthIdentity();

      try {
        const response = await getCurrentUser();
        const accountRole = response.user?.role;
        const user = response.user;

        if (!response.success || !accountRole || !user) {
          throw new Error("Session check failed.");
        }

        if (role && accountRole !== role) {
          saveAuthIdentity({
            fullName: user.fullName ?? localIdentity?.fullName ?? user.email.split("@")[0],
            email: user.email,
            role: accountRole,
          });
          router.replace(`/${accountRole}/dashboard`);
          return;
        }

        saveAuthIdentity({
          fullName: user.fullName ?? localIdentity?.fullName ?? user.email.split("@")[0],
          email: user.email,
          role: accountRole,
        });
      } catch {
        if (isActive) {
          clearAuthIdentity();
          router.replace("/login");
        }
        return;
      }

      if (isActive) {
        setIsReady(true);
      }
    };

    void verifySession();

    return () => {
      isActive = false;
    };
  }, [role, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex items-center gap-3 rounded-full border border-violet-200 bg-white px-4 py-2.5 text-sm font-medium text-violet-700 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
          Checking your session...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
