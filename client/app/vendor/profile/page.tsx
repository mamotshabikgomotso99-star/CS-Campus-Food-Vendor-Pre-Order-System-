import { Mail } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";

export default function VendorProfilePage() {
  return (
    <DashboardLayout
      role="vendor"
      title="Vendor Profile"
      subtitle="Update your vendor information and business details."
    >
      <section className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <ProfilePhoto role="vendor" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-violet-700">Vendor</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">Fresh Bites</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Mail className="h-4 w-4 text-violet-700" />
              vendor@freshbites.co.za
            </p>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
