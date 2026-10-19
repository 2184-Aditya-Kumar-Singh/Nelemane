import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";

import { getEnv } from "@/lib/env";
import { pgRegistrationSchema } from "@/lib/pg-schemas";
import { escapeHtml, serializePgListItem } from "@/server/admin/serializers";
import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { hashPassword } from "@/server/auth/password";
import { connectToDatabase } from "@/server/db/connection";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel, type PgAsset } from "@/server/db/models/pg";
import { TemporaryAssetModel, type UploadPurpose } from "@/server/db/models/temporary-asset";
import { UserModel } from "@/server/db/models/user";
import { getEmailProvider } from "@/server/providers/email";
import { encryptSensitiveValue } from "@/server/security/encryption";

export const runtime = "nodejs";

function safeAsset(
  asset: { url: string; publicId: string; purpose: UploadPurpose } | null,
): PgAsset | undefined {
  return asset ? { url: asset.url, publicId: asset.publicId } : undefined;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function GET(request: Request) {
  try {
    await requireRoles("SUPER_ADMIN");
    await connectToDatabase();
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().slice(0, 100);
    const status = url.searchParams.get("status");
    const subscriptionStatus = url.searchParams.get("subscription");
    const filter: Record<string, unknown> = {};
    if (status === "ACTIVE" || status === "DELETED") filter.status = status;
    if (subscriptionStatus === "ACTIVE" || subscriptionStatus === "SUSPENDED" || subscriptionStatus === "CANCELLED") {
      filter["subscription.status"] = subscriptionStatus;
    }
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { slug: { $regex: escaped, $options: "i" } },
        { "owner.name": { $regex: escaped, $options: "i" } },
        { "owner.email": { $regex: escaped, $options: "i" } },
        { "address.locality": { $regex: escaped, $options: "i" } },
      ];
    }

    const pgs = await PgModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return Response.json({ pgs: pgs.map((pg) => serializePgListItem(pg as never)) });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "PGs could not be loaded" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  }

  let adminId = "";
  let ownerEmail = "";
  try {
    const admin = await requireRoles("SUPER_ADMIN");
    adminId = admin.id;
    const payload: unknown = await request.json();
    const parsed = pgRegistrationSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({
        error: {
          message: "Review the highlighted fields",
          fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      }, { status: 400 });
    }

    const input = parsed.data;
    await connectToDatabase();
    if (await UserModel.exists({ email: input.owner.email })) {
      return Response.json({ error: { message: "An account with this owner email already exists" } }, { status: 409 });
    }

    const session = await mongoose.startSession();
    let ownerId = "";
    let committedPgId = "";
    let committedSlug = "";
    let credential = "";
    try {
      await session.withTransaction(async () => {
        const ownerObjectId = new Types.ObjectId();
        const pgObjectId = new Types.ObjectId();
        ownerId = ownerObjectId.toString();
        committedPgId = pgObjectId.toString();
        committedSlug = `${input.pg.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "pg"}-${randomBytes(3).toString("hex")}`;
        credential = randomBytes(18).toString("base64url");

        const uploadRequirements: Array<{ key: string; id: string | undefined; purpose: UploadPurpose }> = [
          { key: "owner-profile", id: input.owner.profileAssetId, purpose: "OWNER_PROFILE" },
          { key: "pg-profile", id: input.pg.profileAssetId, purpose: "PG_PROFILE" },
          ...input.payment.qrAccounts.map((account, index) => ({ key: `payment-qr-${index}`, id: account.qrAssetId, purpose: "PAYMENT_QR" as const })),
        ];
        const assets = new Map<string, { id: string; url: string; publicId: string }>();
        for (const upload of uploadRequirements) {
          if (!upload.id) continue;
          const asset = await TemporaryAssetModel.findOne({
            _id: upload.id,
            ownerUserId: new Types.ObjectId(adminId),
            purpose: upload.purpose,
            claimedAt: { $exists: false },
            expiresAt: { $gt: new Date() },
          }).session(session).lean();
          if (!asset) throw new Error("UPLOAD_NOT_AVAILABLE");
          assets.set(upload.key, {
            id: asset._id.toString(),
            url: asset.url,
            publicId: asset.publicId,
          });
        }

        const ownerAsset = assets.get("owner-profile");
        const pgAsset = assets.get("pg-profile");
        const qrAccounts = input.payment.qrAccounts.map((account, index) => {
          const asset = assets.get(`payment-qr-${index}`);
          if (!asset) throw new Error("UPLOAD_NOT_AVAILABLE");
          return {
            accountHolderName: account.accountHolderName,
            upiId: account.upiId,
            qrImage: { url: asset.url, publicId: asset.publicId },
          };
        });
        const primaryQr = qrAccounts[0];
        const bank = input.payment.bank
          ? {
              accountHolderName: input.payment.bank.accountHolderName,
              bankName: input.payment.bank.bankName,
              accountNumber: encryptSensitiveValue(input.payment.bank.accountNumber),
              ifsc: input.payment.bank.ifsc,
              branch: input.payment.bank.branch,
            }
          : undefined;

        await UserModel.create([{
          _id: ownerObjectId,
          role: "PG_OWNER",
          name: input.owner.name,
          email: input.owner.email,
          phone: input.owner.phone,
          passwordHash: await hashPassword(credential),
          mustChangePassword: true,
          profilePhoto: ownerAsset ? safeAsset({ ...ownerAsset, purpose: "OWNER_PROFILE" }) : undefined,
          pgId: pgObjectId,
          status: "ACTIVE",
        }], { session });

        await PgModel.create([{
          _id: pgObjectId,
          name: input.pg.name,
          slug: committedSlug,
          ownerUserId: ownerObjectId,
          owner: { name: input.owner.name, phone: input.owner.phone, email: input.owner.email },
          nominee: {
            name: input.pg.nominee.name,
            phone: input.pg.nominee.phone || undefined,
            relation: input.pg.nominee.relation,
          },
          address: {
            ...input.pg.address,
            landmark: input.pg.address.landmark,
            mapsUrl: input.pg.address.mapsUrl || undefined,
          },
          gstNumber: input.pg.gstNumber || undefined,
          profilePhoto: pgAsset ? safeAsset({ ...pgAsset, purpose: "PG_PROFILE" }) : undefined,
          paymentDetails: {
            accountType: input.payment.accountType,
            upiId: primaryQr?.upiId,
            qrImage: primaryQr?.qrImage,
            qrAccounts,
            bank,
            instructions: input.payment.instructions,
          },
          rentWindow: { startDay: 1, endDay: 5 },
          reminder: { enabled: true, everyNDays: 2, email: true, sms: false },
          subscription: {
            status: "ACTIVE",
            planLabel: input.subscription.planLabel,
            startsAt: input.subscription.startsAt,
            endsAt: input.subscription.endsAt,
            notes: input.subscription.notes,
          },
          isListed: false,
          status: "ACTIVE",
        }], { session });

        for (const asset of assets.values()) {
          const claimed = await TemporaryAssetModel.updateOne(
            { _id: asset.id, ownerUserId: adminId, claimedAt: { $exists: false } },
            { $set: { claimedAt: new Date(), pgId: pgObjectId } },
            { session },
          );
          if (claimed.modifiedCount !== 1) throw new Error("UPLOAD_NOT_AVAILABLE");
        }

        await AuditLogModel.create([{
          actorId: new Types.ObjectId(adminId),
          action: "PG_CREATED",
          entity: "PG",
          entityId: pgObjectId,
          meta: { name: input.pg.name, ownerEmail: input.owner.email, subscriptionPlan: input.subscription.planLabel },
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    ownerEmail = input.owner.email;

    let credentialsDelivery: "SENT" | "SKIPPED" | "FAILED" = "FAILED";
    try {
      const appUrl = getEnv().APP_URL;
      const ownerName = escapeHtml(input.owner.name);
      const pgName = escapeHtml(input.pg.name);
      const loginUrl = `${appUrl}/login`;
      const text = [
        `Hello ${input.owner.name},`,
        `Your Nelemane owner account for ${input.pg.name} is ready.`,
        `Sign in: ${loginUrl}`,
        `Email: ${input.owner.email}`,
        `Temporary password: ${credential}`,
        "You will be asked to change this password after signing in.",
      ].join("\n\n");
      const result = await getEmailProvider().send({
        to: input.owner.email,
        template: "pg-owner-welcome",
        dedupeKey: `pg-owner-welcome-${committedPgId}`,
        subject: `Your Nelemane account for ${input.pg.name}`,
        text,
        html: `<p>Hello ${ownerName},</p><p>Your Nelemane owner account for <strong>${pgName}</strong> is ready.</p><p><a href="${escapeHtml(loginUrl)}">Sign in</a></p><p>Email: ${escapeHtml(input.owner.email)}<br>Temporary password: <strong>${escapeHtml(credential)}</strong></p><p>You will be asked to change this password after signing in.</p>`,
      });
      credentialsDelivery = result.status;
    } catch {
      credentialsDelivery = "FAILED";
    }

    if (credentialsDelivery === "FAILED") {
      await AuditLogModel.create({
        actorId: adminId,
        action: "PG_OWNER_CREDENTIAL_EMAIL_FAILED",
        entity: "PG",
        entityId: committedPgId,
        meta: { ownerEmail },
      }).catch(() => undefined);
    }

    return Response.json({
      pg: { id: committedPgId, slug: committedSlug, name: input.pg.name },
      owner: { id: ownerId, email: ownerEmail },
      credentialsDelivery,
    }, { status: 201 });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof Error && error.message === "UPLOAD_NOT_AVAILABLE") {
      return Response.json({ error: { message: "One of the uploaded images expired or is unavailable; upload it again" } }, { status: 400 });
    }
    if (isDuplicateKeyError(error)) {
      return Response.json({ error: { message: "An account or PG with those details already exists" } }, { status: 409 });
    }
    return Response.json({ error: { message: "PG registration could not be completed" } }, { status: 500 });
  } finally {
    ownerEmail = "";
  }
}
