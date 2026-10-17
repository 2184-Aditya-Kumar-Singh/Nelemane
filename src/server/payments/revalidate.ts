import "server-only";

import { revalidatePath } from "next/cache";

export function revalidatePaymentViews(): void {
  for (const path of ["/owner", "/owner/rent", "/owner/payment-verifications", "/tenant", "/tenant/rent"]) {
    revalidatePath(path);
  }
  revalidatePath("/tenant/rent/[chargeId]", "page");
  revalidatePath("/tenant/receipts/[paymentId]", "page");
}
