import { RequireAuth } from "@/components/auth/RequireAuth";
import { StudentPaymentResult } from "@/components/orders/StudentPaymentResult";

export default async function StudentPaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string; cancelled?: string }>;
}) {
  const params = await searchParams;
  return (
    <RequireAuth role="student">
      <StudentPaymentResult paymentId={params.paymentId ?? ""} cancelled={params.cancelled === "1"} />
    </RequireAuth>
  );
}