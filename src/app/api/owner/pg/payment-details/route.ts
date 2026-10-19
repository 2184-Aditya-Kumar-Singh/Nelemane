import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";

import { ownerPaymentDetailsSchema, ownerPhotoReferenceSchema } from "@/lib/owner-schemas";
import { escapeHtml } from "@/server/admin/serializers";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { getEnv } from "@/lib/env";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel, type PgAsset, type PgQrAccount } from "@/server/db/models/pg";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { getEmailProvider } from "@/server/providers/email";
import { getStorageProvider } from "@/server/providers/storage";
import { decryptSensitiveValue, encryptSensitiveValue } from "@/server/security/encryption";

type PhotoReference = typeof ownerPhotoReferenceSchema._output;

export async function GET() {
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    await connectToDatabase();
    const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).lean();
    if (!pg) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    const storedQrAccounts: PgQrAccount[] = pg.paymentDetails.qrAccounts?.length
      ? pg.paymentDetails.qrAccounts
      : pg.paymentDetails.qrImage
        ? [{ accountHolderName: pg.owner.name, upiId: pg.paymentDetails.upiId ?? "", qrImage: pg.paymentDetails.qrImage }]
        : [];
    const qrAccounts = storedQrAccounts.map((account, index) => ({
      accountHolderName: account.accountHolderName,
      upiId: account.upiId,
      qrImage: {
        publicId: account.qrImage.publicId,
        previewUrl: `/api/owner/pg/payment-details/qr/${index}`,
      },
    }));
    const bank = pg.paymentDetails.bank
      ? {
          accountHolderName: pg.paymentDetails.bank.accountHolderName ?? "",
          bankName: pg.paymentDetails.bank.bankName ?? "",
          accountNumber: decryptSensitiveValue(pg.paymentDetails.bank.accountNumber),
          ifsc: pg.paymentDetails.bank.ifsc ?? "",
          branch: pg.paymentDetails.bank.branch ?? "",
        }
      : null;
    return Response.json({
      paymentDetails: {
        accountType: pg.paymentDetails.accountType,
        upiId: pg.paymentDetails.upiId ?? "",
        qrImage: pg.paymentDetails.qrImage ? { publicId: pg.paymentDetails.qrImage.publicId } : null,
        qrAccounts,
        bank,
        instructions: pg.paymentDetails.instructions ?? "",
      },
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Payment details could not be loaded" } }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const parsed = ownerPaymentDetailsSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) {
      return Response.json({
        error: {
          message: "Review the highlighted payment details",
          fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      }, { status: 400 });
    }

    await connectToDatabase();
    const session = await mongoose.startSession();
    const eventId = randomUUID();
    let pgName = "";
    let changedFields: string[] = [];
    let removedQrIds: string[] = [];
    try {
      await session.withTransaction(async () => {
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).session(session);
        if (!pg) throw new Error("PG_NOT_AVAILABLE");
        pgName = pg.name;
        const currentQrAccounts: PgQrAccount[] = pg.paymentDetails.qrAccounts?.length
          ? pg.paymentDetails.qrAccounts
          : pg.paymentDetails.qrImage
            ? [{ accountHolderName: pg.owner.name, upiId: pg.paymentDetails.upiId ?? "", qrImage: pg.paymentDetails.qrImage }]
            : [];
        const currentQrByPublicId = new Map(currentQrAccounts.map((account) => [account.qrImage.publicId, account.qrImage]));
        const nextQrAccounts: PgQrAccount[] = [];
        const newlyUploadedIds: string[] = [];
        const seenPublicIds = new Set<string>();
        for (const account of parsed.data.qrAccounts) {
          const reference = account.qrImage as PhotoReference;
          let nextImage: PgAsset;
          if (reference.assetId) {
            const upload = await TemporaryAssetModel.findOne({
              _id: reference.assetId,
              ownerUserId: user.id,
              pgId,
              purpose: "OWNER_PAYMENT_QR",
              visibility: "private",
              claimedAt: { $exists: false },
              expiresAt: { $gt: new Date() },
            }).session(session).lean();
            if (!upload) throw new Error("UPLOAD_NOT_AVAILABLE");
            nextImage = { publicId: upload.publicId, url: upload.url };
            newlyUploadedIds.push(upload._id.toString());
          } else if (reference.publicId && currentQrByPublicId.has(reference.publicId)) {
            nextImage = currentQrByPublicId.get(reference.publicId)!;
          } else {
            throw new Error("PHOTO_NOT_AVAILABLE");
          }
          if (seenPublicIds.has(nextImage.publicId)) throw new Error("DUPLICATE_QR");
          seenPublicIds.add(nextImage.publicId);
          nextQrAccounts.push({ accountHolderName: account.accountHolderName, upiId: account.upiId, qrImage: nextImage });
        }

        const oldBank = pg.paymentDetails.bank;
        if (parsed.data.accountType === "PERSONAL" && !nextQrAccounts.length) throw new Error("PERSONAL_QR_REQUIRED");
        let nextBank = oldBank;
        if (parsed.data.bank === null) {
          nextBank = undefined;
        } else if (parsed.data.bank) {
          nextBank = {
            accountHolderName: parsed.data.bank.accountHolderName,
            bankName: parsed.data.bank.bankName,
            accountNumber: encryptSensitiveValue(parsed.data.bank.accountNumber),
            ifsc: parsed.data.bank.ifsc,
            branch: parsed.data.bank.branch || undefined,
          };
        }
        if (!nextQrAccounts.length && !nextBank) throw new Error("PAYMENT_METHOD_REQUIRED");

        const oldAccountNumber = oldBank ? decryptSensitiveValue(oldBank.accountNumber) : "";
        const nextAccountNumber = parsed.data.bank?.accountNumber ?? oldAccountNumber;
        const bankChanged = Boolean(oldBank) !== Boolean(nextBank) || Boolean(
          oldBank && nextBank && (
            oldBank.accountHolderName !== nextBank.accountHolderName ||
            oldBank.bankName !== nextBank.bankName ||
            oldBank.ifsc !== nextBank.ifsc ||
            (oldBank.branch ?? "") !== (nextBank.branch ?? "") ||
            oldAccountNumber !== nextAccountNumber
          ),
        );
        changedFields = [];
        if (pg.paymentDetails.accountType !== parsed.data.accountType) changedFields.push("account type");
        const previousQrFingerprint = JSON.stringify(currentQrAccounts.map((account) => ({ accountHolderName: account.accountHolderName, upiId: account.upiId, publicId: account.qrImage.publicId })));
        const nextQrFingerprint = JSON.stringify(nextQrAccounts.map((account) => ({ accountHolderName: account.accountHolderName, upiId: account.upiId, publicId: account.qrImage.publicId })));
        if (previousQrFingerprint !== nextQrFingerprint) changedFields.push("QR payment accounts");
        if (bankChanged) changedFields.push("bank details");
        if ((pg.paymentDetails.instructions ?? "") !== (parsed.data.instructions ?? "")) changedFields.push("payment instructions");

        const nextQrIds = new Set(nextQrAccounts.map((account) => account.qrImage.publicId));
        removedQrIds = [...new Set(currentQrAccounts.map((account) => account.qrImage.publicId).filter((publicId) => !nextQrIds.has(publicId)))];
        pg.paymentDetails = {
          accountType: parsed.data.accountType,
          upiId: nextQrAccounts[0]?.upiId,
          qrImage: nextQrAccounts[0]?.qrImage,
          qrAccounts: nextQrAccounts,
          bank: nextBank,
          instructions: parsed.data.instructions || undefined,
        };
        await pg.save({ session });
        for (const newlyUploadedId of newlyUploadedIds) {
          const claimed = await TemporaryAssetModel.updateOne(
            { _id: newlyUploadedId, ownerUserId: user.id, pgId, claimedAt: { $exists: false } },
            { $set: { claimedAt: new Date() } },
            { session },
          );
          if (claimed.modifiedCount !== 1) throw new Error("UPLOAD_NOT_AVAILABLE");
        }
        if (changedFields.length) {
          await AuditLogModel.create([{
            actorId: new Types.ObjectId(user.id),
            action: "PG_PAYMENT_DETAILS_UPDATED",
            entity: "PG",
            entityId: new Types.ObjectId(pgId),
            meta: { changedFields },
          }], { session });
        }
      });
    } finally {
      await session.endSession();
    }

    let notificationStatus: "SENT" | "SKIPPED" | "FAILED" | "NOT_NEEDED" = "NOT_NEEDED";
    if (changedFields.length) {
      const message = `Payment details for ${pgName} were updated by ${user.name} (${user.email}). Changed: ${changedFields.join(", ")}.`;
      try {
        const result = await getEmailProvider().send({
          to: getEnv().ADMIN_EMAIL,
          template: "pg-payment-details-updated",
          dedupeKey: `pg-payment-details-${pgId}-${eventId}`,
          subject: `Payment details updated: ${pgName}`,
          text: message,
          html: `<p>${escapeHtml(message)}</p>`,
        });
        notificationStatus = result.status;
      } catch {
        notificationStatus = "FAILED";
      }
    }

    let imageCleanup = "COMPLETE";
    for (const removedQrId of removedQrIds) {
      try {
        await getStorageProvider().delete(removedQrId);
        await TemporaryAssetModel.deleteOne({ pgId, publicId: removedQrId });
      } catch {
        imageCleanup = "PENDING";
      }
    }
    return Response.json({ saved: true, notificationStatus, imageCleanup });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof Error && error.message === "PG_NOT_AVAILABLE") return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") return Response.json({ error: { message: "The uploaded QR expired or is unavailable; upload it again" } }, { status: 400 });
    if (error instanceof Error && error.message === "PHOTO_NOT_AVAILABLE") return Response.json({ error: { message: "The selected QR image is invalid" } }, { status: 400 });
    if (error instanceof Error && error.message === "DUPLICATE_QR") return Response.json({ error: { message: "Use a different image for each QR account" } }, { status: 400 });
    if (error instanceof Error && error.message === "PERSONAL_QR_REQUIRED") return Response.json({ error: { message: "Personal accounts require a QR image" } }, { status: 400 });
    if (error instanceof Error && error.message === "PAYMENT_METHOD_REQUIRED") return Response.json({ error: { message: "Add a QR image or bank details" } }, { status: 400 });
    return Response.json({ error: { message: "Payment details could not be saved" } }, { status: 500 });
  }
}
