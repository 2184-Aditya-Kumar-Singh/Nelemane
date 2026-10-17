import { Types } from "mongoose";
import { z } from "zod";

import { authorizationErrorResponse, requirePgScope, requireRoles } from "@/server/auth/authorization";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { TemporaryAssetModel, type UploadPurpose } from "@/server/db/models/temporary-asset";
import { getStorageProvider } from "@/server/providers/storage";

export const runtime = "nodejs";

const purposeSchema = z.enum(["OWNER_PG_PROFILE", "PG_GALLERY", "ROOM_TYPE_PHOTO", "OWNER_PAYMENT_QR", "TENANT_PROFILE", "TENANT_AADHAAR", "OWNER_PAYMENT_PROOF"]);

function detectImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const user = await requireRoles("PG_OWNER");
    const pgId = requirePgScope(user);
    const form = await request.formData();
    const purposeResult = purposeSchema.safeParse(form.get("purpose"));
    const file = form.get("file");
    if (!purposeResult.success || !(file instanceof File)) {
      return Response.json({ error: { message: "Choose an image and upload purpose" } }, { status: 400 });
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      return Response.json({ error: { message: "Images must be between 1 byte and 5 MB" } }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = detectImageContentType(bytes);
    if (!contentType) return Response.json({ error: { message: "Upload a valid JPEG, PNG, or WebP image" } }, { status: 400 });

    await connectToDatabase();
    const pg = await PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("_id").lean();
    if (!pg) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });

    const purpose: UploadPurpose = purposeResult.data;
    const privateAsset = purpose === "OWNER_PAYMENT_QR" || purpose === "TENANT_PROFILE" || purpose === "TENANT_AADHAAR" || purpose === "OWNER_PAYMENT_PROOF";
    const stored = await getStorageProvider().upload({
      bytes,
      contentType,
      resourceType: "image",
      visibility: privateAsset ? "private" : "public",
      folder: `nelemane/pgs/${pgId}/${purpose.toLowerCase()}`,
    });
    let asset;
    try {
      asset = await TemporaryAssetModel.create({
        ownerUserId: new Types.ObjectId(user.id),
        pgId: new Types.ObjectId(pgId),
        purpose,
        publicId: stored.publicId,
        url: stored.url,
        resourceType: stored.resourceType,
        visibility: stored.visibility,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      await getStorageProvider().delete(stored.publicId).catch(() => undefined);
      throw error;
    }
    const previewUrl = privateAsset
      ? await getStorageProvider().getSignedUrl(stored.publicId, 60)
      : stored.url;
    return Response.json({ asset: { id: asset._id.toString(), purpose, previewUrl } }, { status: 201 });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "The image could not be uploaded" } }, { status: 500 });
  }
}
