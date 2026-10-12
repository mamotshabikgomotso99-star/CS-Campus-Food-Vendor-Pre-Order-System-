import { RequireAuth } from "@/components/auth/RequireAuth";
import { StudentVendorMenu } from "@/components/menu/StudentVendorMenu";

export default async function StudentVendorMenuPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  return (
    <RequireAuth role="student">
      <StudentVendorMenu vendorId={vendorId} />
    </RequireAuth>
  );
}
