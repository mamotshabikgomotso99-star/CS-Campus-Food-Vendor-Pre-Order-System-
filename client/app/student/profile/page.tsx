import { Mail } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SignedInEmail, SignedInName } from "@/components/auth/AuthIdentityProvider";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";

export default function StudentProfilePage() {
  return (
    <DashboardLayout
      role="student"
      title="Profile"
      subtitle="Manage your account details and preferences."
    >
      <section className="rounded-[28px] border border-violet-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <ProfilePhoto role="student" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-violet-700">Student</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900"><SignedInName /></h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Mail className="h-4 w-4 text-violet-700" />
              <SignedInEmail />
            </p>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
