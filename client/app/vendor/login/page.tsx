import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export default function VendorLoginPage() {
  return (
    <AuthLayout>
      <LoginForm role="vendor" />
    </AuthLayout>
  );
}