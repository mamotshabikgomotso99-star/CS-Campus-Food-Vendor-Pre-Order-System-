import { AuthLayout } from "@/components/auth/AuthLayout";
import { VendorApplicationForm } from "@/components/auth/VendorApplicationForm";

export default function VendorApplicationPage() {
  return (
    <AuthLayout>
      <VendorApplicationForm />
    </AuthLayout>
  );
}