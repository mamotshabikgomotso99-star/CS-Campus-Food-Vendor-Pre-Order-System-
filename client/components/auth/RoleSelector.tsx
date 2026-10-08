import { GraduationCap, Store } from "lucide-react";
import type { AccountRole } from "@/lib/validations";

type RoleSelectorProps = {
  value: AccountRole | "";
  onChange: (value: AccountRole) => void;
  error?: string;
  showVendor?: boolean;
};

const roles = [
  {
    value: "student" as const,
    label: "Student",
    description: "Order meals and track your pickups",
    icon: GraduationCap,
  },
  {
    value: "vendor" as const,
    label: "Vendor",
    description: "Manage menus and incoming orders",
    icon: Store,
  },
];

export function RoleSelector({ value, onChange, error, showVendor = false }: RoleSelectorProps) {
  const visibleRoles = showVendor ? roles : roles.filter((role) => role.value === value);

  return (
    <div className="space-y-2">
      <p className="block text-sm font-medium text-slate-800">Account type</p>
      <div className="grid gap-3">
        {visibleRoles.map(({ value: roleValue, label, description, icon: Icon }) => {
          const selected = value === roleValue;

          return (
            <button
              key={roleValue}
              type="button"
              onClick={() => onChange(roleValue)}
              className={[
                "rounded-2xl border p-3 text-left transition-all duration-200",
                selected
                  ? "border-violet-600 bg-violet-50 ring-2 ring-violet-100"
                  : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40",
              ].join(" ")}
              aria-pressed={selected}
            >
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    selected ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
