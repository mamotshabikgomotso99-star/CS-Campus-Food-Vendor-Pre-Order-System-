import type { AuthRole } from "@/lib/api";

const AUTH_IDENTITY_KEY = "campus-eats-auth-identity";
const AUTH_IDENTITY_EVENT = "campus-eats-auth-identity-change";
let cachedIdentityValue: string | null = null;
let cachedIdentity: AuthIdentity | null = null;

export type AuthIdentity = {
  fullName: string;
  email: string;
  role: AuthRole;
};

export function saveAuthIdentity(identity: AuthIdentity) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(AUTH_IDENTITY_KEY, JSON.stringify(identity));
    window.dispatchEvent(new Event(AUTH_IDENTITY_EVENT));
  }
}

export function readAuthIdentity(): AuthIdentity | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedIdentity = window.sessionStorage.getItem(AUTH_IDENTITY_KEY);
    if (!storedIdentity) {
      cachedIdentityValue = null;
      cachedIdentity = null;
      return null;
    }

    if (storedIdentity === cachedIdentityValue) {
      return cachedIdentity;
    }

    const identity = JSON.parse(storedIdentity) as Partial<AuthIdentity>;
    if (
      typeof identity.fullName === "string" &&
      typeof identity.email === "string" &&
      (identity.role === "student" || identity.role === "vendor")
    ) {
      cachedIdentityValue = storedIdentity;
      cachedIdentity = {
        fullName: identity.fullName,
        email: identity.email,
        role: identity.role,
      };
      return cachedIdentity;
    }
  } catch {
    cachedIdentityValue = null;
    cachedIdentity = null;
    return null;
  }

  cachedIdentityValue = null;
  cachedIdentity = null;
  return null;
}

export function clearAuthIdentity() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(AUTH_IDENTITY_KEY);
    cachedIdentityValue = null;
    cachedIdentity = null;
    window.dispatchEvent(new Event(AUTH_IDENTITY_EVENT));
  }
}

export function subscribeToAuthIdentity(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(AUTH_IDENTITY_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_IDENTITY_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getIdentityName(identity: AuthIdentity | null) {
  return identity?.fullName.trim() || identity?.email.split("@")[0] || "Your account";
}

export function getIdentityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}