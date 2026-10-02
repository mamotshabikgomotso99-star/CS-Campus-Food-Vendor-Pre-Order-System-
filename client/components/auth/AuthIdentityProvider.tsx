"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  getIdentityName,
  readAuthIdentity,
  subscribeToAuthIdentity,
  type AuthIdentity,
} from "@/lib/auth-session";

const AuthIdentityContext = createContext<AuthIdentity | null>(null);

export function AuthIdentityProvider({ children }: { children: ReactNode }) {
  const identity = useSyncExternalStore(
    subscribeToAuthIdentity,
    readAuthIdentity,
    () => null,
  );

  return (
    <AuthIdentityContext.Provider value={identity}>
      {children}
    </AuthIdentityContext.Provider>
  );
}

export function useAuthIdentity() {
  return useContext(AuthIdentityContext);
}

export function SignedInName() {
  const identity = useAuthIdentity();
  return <>{getIdentityName(identity)}</>;
}

export function SignedInEmail() {
  const identity = useAuthIdentity();
  return <>{identity?.email || "No email on file"}</>;
}

export function StudentDashboardGreeting() {
  const identity = useAuthIdentity();
  return <>Good morning, {getIdentityName(identity)}!</>;
}