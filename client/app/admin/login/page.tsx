import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export default function AdminLoginPage() {
  return (
    <AuthLayout>
      <LoginForm mode="admin" />
    </AuthLayout>
  );
}