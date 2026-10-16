import { RequireAuth } from "@/components/auth/RequireAuth";
import { VendorRequestsPanel } from "@/components/admin/VendorRequestsPanel";

export default function AdminDashboardPage() {
  return (
    <RequireAuth role="admin">
      <VendorRequestsPanel />
    </RequireAuth>
  );
}