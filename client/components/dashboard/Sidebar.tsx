"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardCheck,
  ClipboardList,
  LayoutGrid,
  LogOut,
  ShoppingBag,
  Store,
  UserCircle,
  UtensilsCrossed,
} from "lucide-react";
import { clearAuthIdentity, getIdentityInitials, getIdentityName } from "@/lib/auth-session";
import { useAuthIdentity } from "@/components/auth/AuthIdentityProvider";
import { logoutUser } from "@/lib/api";

const studentLinks = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/student/vendors", label: "Vendors", icon: Store },
  { href: "/student/orders", label: "Orders", icon: ClipboardList },
  { href: "/student/profile", label: "Profile", icon: UserCircle },
];

const vendorLinks = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/vendor/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/vendor/orders", label: "Orders", icon: ClipboardCheck },
  { href: "/vendor/profile", label: "Profile", icon: UserCircle },
];

export function Sidebar({ role }: { role: "student" | "vendor" }) {
  const pathname = usePathname();
  const router = useRouter();
  const identity = useAuthIdentity();
  const displayName = getIdentityName(identity);
  const links = role === "student" ? studentLinks : vendorLinks;

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Clear the local identity even when the API is unavailable.
    } finally {
      clearAuthIdentity();
      router.push("/login");
    }
  };

  return (
    <aside className="w-full shrink-0 rounded-[28px] border border-white/60 bg-[#B8B7E5] p-4 text-slate-900 shadow-[0_18px_40px_rgba(124,58,237,0.12)] lg:w-[280px]">
      <div className="flex items-center gap-3 border-b border-white/50 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/65 text-violet-700">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-800/75">
            Campus Eats
          </p>
          <p className="text-sm font-semibold text-slate-900">Kitchen Portal</p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-slate-700 hover:bg-white/45 hover:text-violet-800",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-white/50 bg-white/35 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/65 text-sm font-semibold text-violet-800">
            {getIdentityInitials(displayName) || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
            <p className="text-xs text-violet-800/75">
              {role === "student" ? "Student" : "Vendor"}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/25 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white/55 hover:text-violet-800"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </aside>
  );
}
