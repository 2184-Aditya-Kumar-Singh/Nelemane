import { PaymentVerificationWorkspace } from "@/app/owner/payment-verifications/payment-verification-workspace";

export const dynamic = "force-dynamic";

export default function PaymentVerificationPage() {
  return <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Owner workspace</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Payment verifications</h1><p className="text-foreground/60 mt-2 text-sm">Review tenant transfers and match them to your records.</p><div className="mt-7"><PaymentVerificationWorkspace /></div></main>;
}
