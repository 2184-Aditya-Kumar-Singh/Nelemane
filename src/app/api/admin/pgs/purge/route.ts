import mongoose, { Types } from "mongoose";
import { z } from "zod";

import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { AdminReportModel } from "@/server/db/models/admin-report";
import { AuditLogModel } from "@/server/db/models/audit-log";
import { PgModel } from "@/server/db/models/pg";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel } from "@/server/db/models/room-type";
import { TenantModel } from "@/server/db/models/tenant";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { UserModel } from "@/server/db/models/user";
import { getStorageProvider } from "@/server/providers/storage";

const purgeSchema = z.object({ confirm: z.literal("PURGE") });
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

async function deleteStoredAssets(ids: Set<string>): Promise<void> {
  for (const id of ids) await getStorageProvider().delete(id);
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const admin = await requireRoles("SUPER_ADMIN");
    const parsed = purgeSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return Response.json({ error: { message: "Type PURGE to continue" } }, { status: 400 });
    await connectToDatabase();
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const candidates = await PgModel.find({ status: "DELETED", deletedAt: { $lte: cutoff } }).sort({ deletedAt: 1 }).limit(20).lean();
    let purged = 0;
    const failures: string[] = [];

    for (const pg of candidates) {
      try {
        const users = await UserModel.find({ pgId: pg._id }).select("profilePhoto").lean();
        const claimedUploads = await TemporaryAssetModel.find({ pgId: pg._id }).lean();
        const assetIds = new Set<string>();
        if (pg.profilePhoto?.publicId) assetIds.add(pg.profilePhoto.publicId);
        if (pg.paymentDetails.qrImage?.publicId) assetIds.add(pg.paymentDetails.qrImage.publicId);
        for (const photo of pg.photos) assetIds.add(photo.publicId);
        for (const user of users) if (user.profilePhoto?.publicId) assetIds.add(user.profilePhoto.publicId);
        for (const upload of claimedUploads) assetIds.add(upload.publicId);
        await deleteStoredAssets(assetIds);

        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const latest = await PgModel.findOne({ _id: pg._id, status: "DELETED", deletedAt: { $lte: cutoff } }).session(session);
            if (!latest) return;
            await AuditLogModel.create([{
              actorId: new Types.ObjectId(admin.id),
              action: "PG_PERMANENTLY_PURGED",
              entity: "PG",
              entityId: pg._id,
              meta: { slug: pg.slug, deletedAt: pg.deletedAt },
            }], { session });
            await Promise.all([
              AdminReportModel.deleteMany({ pgId: pg._id }, { session }),
              TemporaryAssetModel.deleteMany({ pgId: pg._id }, { session }),
              TenantModel.deleteMany({ pgId: pg._id }, { session }),
              RoomModel.deleteMany({ pgId: pg._id }, { session }),
              RoomTypeModel.deleteMany({ pgId: pg._id }, { session }),
              UserModel.deleteMany({ pgId: pg._id }, { session }),
              PgModel.deleteOne({ _id: pg._id }, { session }),
            ]);
            purged += 1;
          });
        } finally {
          await session.endSession();
        }
      } catch {
        failures.push(pg._id.toString());
      }
    }

    const expiredUploads = await TemporaryAssetModel.find({
      claimedAt: { $exists: false },
      expiresAt: { $lte: new Date() },
    }).limit(200).lean();
    let expiredUploadCleanup = 0;
    for (const upload of expiredUploads) {
      try {
        await getStorageProvider().delete(upload.publicId);
        await TemporaryAssetModel.deleteOne({ _id: upload._id, claimedAt: { $exists: false } });
        expiredUploadCleanup += 1;
      } catch {
        failures.push(`upload:${upload._id.toString()}`);
      }
    }

    return Response.json({ purged, expiredUploadCleanup, failures });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "Purging could not be completed" } }, { status: 500 });
  }
}
