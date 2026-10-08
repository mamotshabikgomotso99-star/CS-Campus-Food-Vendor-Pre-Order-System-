import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { role } = await searchParams;
  const initialRole = role === "vendor" ? "vendor" : "student";

  return (
    <AuthLayout showBrandIcon={initialRole !== "vendor"}>
      <RegisterForm initialRole={initialRole} showVendor={false} />
    </AuthLayout>
  );
}
