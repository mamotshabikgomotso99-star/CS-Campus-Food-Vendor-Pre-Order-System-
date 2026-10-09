import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { role } = await searchParams;
  if (role === "vendor") {
    redirect("/register");
  }

  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
