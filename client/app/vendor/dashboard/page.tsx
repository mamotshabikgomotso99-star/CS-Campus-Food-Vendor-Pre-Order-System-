import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { VendorOrderOverview } from "@/components/orders/VendorOrderOverview";

export default function VendorDashboardPage() {
  return (
    <DashboardLayout
      role="vendor"
      title="Welcome back, Fresh Bites!"
      subtitle="Manage your menu and keep campus orders moving."
    >
      <VendorOrderOverview />
    </DashboardLayout>
  );
}
