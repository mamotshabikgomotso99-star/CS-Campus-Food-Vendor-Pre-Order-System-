import { StudentCheckout } from "@/components/orders/StudentCheckout";

export default async function StudentNewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ vendorId?: string; itemId?: string }>;
}) {
  const params = await searchParams;
  return <StudentCheckout initialVendorId={params.vendorId} initialItemId={params.itemId} />;
}
