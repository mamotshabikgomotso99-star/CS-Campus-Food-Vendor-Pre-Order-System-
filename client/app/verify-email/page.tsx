import { AuthLayout } from "@/components/auth/AuthLayout";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <VerifyEmailForm />
    </AuthLayout>
  );
}
