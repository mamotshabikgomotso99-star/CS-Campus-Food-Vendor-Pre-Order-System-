import { RequireAuth } from "@/components/auth/RequireAuth";
import { VendorMenuManager } from "@/components/menu/VendorMenuManager";

export default function VendorMenuPage() {
  return (
    <RequireAuth role="vendor">
      <VendorMenuManager />
    </RequireAuth>
  );
}
