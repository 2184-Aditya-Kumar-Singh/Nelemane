import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";

import { ownerPaymentDetailsSchema, ownerPhotoReferenceSchema } from "@/lib/owner-schemas";
import { escapeHtml } from "@/server/admin/serializers";
import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { getEnv } from "@/lib/env";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel, type PgAsset } from "@/server/db/models/pg";
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
    const qrImage = pg.paymentDetails.qrImage
      ? {
          publicId: pg.paymentDetails.qrImage.publicId,
          previewUrl: await getStorageProvider().getSignedUrl(pg.paymentDetails.qrImage.publicId, 60).catch(() => ""),
        }
      : null;
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
        qrImage,
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
    let removedQrId = "";
    try {
      await session.withTransaction(async () => {
        const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).session(session);
        if (!pg) throw new Error("PG_NOT_AVAILABLE");
        pgName = pg.name;
        const currentQr = pg.paymentDetails.qrImage;
        let nextQr: PgAsset | undefined = currentQr;
        let newlyUploadedId = "";
        if (parsed.data.qrImage !== undefined) {
          if (parsed.data.qrImage === null) {
            nextQr = undefined;
          } else {
            const reference = parsed.data.qrImage as PhotoReference;
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
              nextQr = { publicId: upload.publicId, url: upload.url };
              newlyUploadedId = upload._id.toString();
            } else if (reference.publicId && currentQr?.publicId === reference.publicId) {
              nextQr = currentQr;
            } else {
              throw new Error("PHOTO_NOT_AVAILABLE");
            }
          }
        }

        const oldBank = pg.paymentDetails.bank;
        if (parsed.data.accountType === "PERSONAL" && !nextQr) throw new Error("PERSONAL_QR_REQUIRED");
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
        if (!nextQr && !nextBank) throw new Error("PAYMENT_METHOD_REQUIRED");

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
        if ((pg.paymentDetails.upiId ?? "") !== (parsed.data.upiId ?? "")) changedFields.push("UPI ID");
        if ((currentQr?.publicId ?? "") !== (nextQr?.publicId ?? "")) changedFields.push("payment QR");
        if (bankChanged) changedFields.push("bank details");
        if ((pg.paymentDetails.instructions ?? "") !== (parsed.data.instructions ?? "")) changedFields.push("payment instructions");

        if (currentQr && currentQr.publicId !== nextQr?.publicId) removedQrId = currentQr.publicId;
        pg.paymentDetails = {
          accountType: parsed.data.accountType,
          upiId: parsed.data.upiId || undefined,
          qrImage: nextQr,
          bank: nextBank,
          instructions: parsed.data.instructions || undefined,
        };
        await pg.save({ session });
        if (newlyUploadedId) {
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
    if (removedQrId) {
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
    if (error instanceof Error && error.message === "PERSONAL_QR_REQUIRED") return Response.json({ error: { message: "Personal accounts require a QR image" } }, { status: 400 });
    if (error instanceof Error && error.message === "PAYMENT_METHOD_REQUIRED") return Response.json({ error: { message: "Add a QR image or bank details" } }, { status: 400 });
    return Response.json({ error: { message: "Payment details could not be saved" } }, { status: 500 });
  }
}
