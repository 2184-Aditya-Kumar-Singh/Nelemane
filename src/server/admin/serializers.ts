import "server-only";

import type { PgRecord } from "@/server/db/models/pg";
import { decryptSensitiveValue } from "@/server/security/encryption";

type PgWithId = PgRecord & { _id: { toString(): string } };

export function serializePgListItem(pg: PgWithId) {
  return {
    id: pg._id.toString(),
    name: pg.name,
    slug: pg.slug,
    owner: pg.owner,
    locality: pg.address.locality,
    pincode: pg.address.pincode,
    subscription: pg.subscription,
    isListed: pg.isListed,
    status: pg.status,
    deletedAt: pg.deletedAt ?? null,
    createdAt: pg.createdAt,
  };
}

export function serializePgAdminDetail(pg: PgWithId) {
  const accountNumber = pg.paymentDetails.bank?.accountNumber;
  const lastFour = accountNumber
    ? decryptSensitiveValue(accountNumber).slice(-4)
    : undefined;

  return {
    ...serializePgListItem(pg),
    ownerUserId: pg.ownerUserId.toString(),
    owner: pg.owner,
    nominee: pg.nominee,
    address: pg.address,
    gstNumber: pg.gstNumber ?? "",
    profilePhoto: pg.profilePhoto ?? null,
    paymentDetails: {
      accountType: pg.paymentDetails.accountType,
      upiId: pg.paymentDetails.upiId ?? "",
      qrImage: pg.paymentDetails.qrImage
        ? { publicId: pg.paymentDetails.qrImage.publicId }
        : null,
      qrAccounts: (pg.paymentDetails.qrAccounts?.length
        ? pg.paymentDetails.qrAccounts
        : pg.paymentDetails.qrImage
          ? [{ accountHolderName: pg.owner.name, upiId: pg.paymentDetails.upiId ?? "", qrImage: pg.paymentDetails.qrImage }]
          : []).map((account) => ({ accountHolderName: account.accountHolderName, upiId: account.upiId, qrImage: { publicId: account.qrImage.publicId } })),
      bank: pg.paymentDetails.bank
        ? {
            accountHolderName: pg.paymentDetails.bank.accountHolderName,
            bankName: pg.paymentDetails.bank.bankName,
            accountNumberLastFour: lastFour,
            ifsc: pg.paymentDetails.bank.ifsc,
            branch: pg.paymentDetails.bank.branch ?? "",
          }
        : null,
      instructions: pg.paymentDetails.instructions ?? "",
    },
    subscription: {
      ...pg.subscription,
      startsAt: pg.subscription.startsAt.toISOString().slice(0, 10),
      endsAt: pg.subscription.endsAt.toISOString().slice(0, 10),
    },
    createdAt: pg.createdAt.toISOString(),
    updatedAt: pg.updatedAt.toISOString(),
  };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}
