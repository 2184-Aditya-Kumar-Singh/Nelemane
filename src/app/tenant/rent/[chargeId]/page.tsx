import { notFound } from "next/navigation";

import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { RentPaymentDetail } from "@/app/tenant/rent/[chargeId]/rent-payment-detail";

export const dynamic = "force-dynamic";

export default async function TenantRentChargePage({ params }: { params: Promise<{ chargeId: string }> }) {
  await requireActiveTenant();
  const { chargeId } = await params;
  if (!/^[a-f\d]{24}$/i.test(chargeId)) notFound();
  return <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Rent charge</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Pay rent</h1><div className="mt-7"><RentPaymentDetail chargeId={chargeId} /></div></main>;
}
