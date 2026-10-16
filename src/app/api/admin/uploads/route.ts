import { Types } from "mongoose";
import { z } from "zod";

import { authorizationErrorResponse, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { TemporaryAssetModel, type UploadPurpose } from "@/server/db/models/temporary-asset";
import { getStorageProvider } from "@/server/providers/storage";
import { hasSameOrigin } from "@/server/auth/request-origin";

export const runtime = "nodejs";

const purposeSchema = z.enum(["OWNER_PROFILE", "PG_PROFILE", "PAYMENT_QR"]);

function detectImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  }

  try {
    const admin = await requireRoles("SUPER_ADMIN");
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
    const detectedType = detectImageContentType(bytes);
    if (!detectedType) {
      return Response.json({ error: { message: "Upload a valid JPEG, PNG, or WebP image" } }, { status: 400 });
    }

    const purpose: UploadPurpose = purposeResult.data;
    const stored = await getStorageProvider().upload({
      bytes,
      contentType: detectedType,
      resourceType: "image",
      visibility: purpose === "PAYMENT_QR" ? "private" : "public",
      folder: `nelemane/pg-registration/${admin.id}/${purpose.toLowerCase()}`,
    });

    await connectToDatabase();
    let asset;
    try {
      asset = await TemporaryAssetModel.create({
        ownerUserId: new Types.ObjectId(admin.id),
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

    const previewUrl = stored.visibility === "private"
      ? await getStorageProvider().getSignedUrl(stored.publicId, 60)
      : stored.url;
    return Response.json({
      asset: { id: asset._id.toString(), purpose, previewUrl, expiresAt: asset.expiresAt.toISOString() },
    }, { status: 201 });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return Response.json({ error: { message: "The image could not be uploaded" } }, { status: 500 });
  }
}
