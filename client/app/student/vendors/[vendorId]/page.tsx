import { StudentVendorMenu } from "@/components/menu/StudentVendorMenu";

export default async function StudentVendorMenuPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  return <StudentVendorMenu vendorId={vendorId} />;
}
