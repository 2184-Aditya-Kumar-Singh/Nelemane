import { Types } from "mongoose";

import { authorizationErrorResponse } from "@/server/auth/authorization";
import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { hasSameOrigin } from "@/server/auth/request-origin";
import { PgModel } from "@/server/db/models/pg";
import { TemporaryAssetModel } from "@/server/db/models/temporary-asset";
import { getStorageProvider } from "@/server/providers/storage";

export const runtime = "nodejs";

function detectImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: { message: "Request origin is not allowed" } }, { status: 403 });
  try {
    const { user, pgId } = await requireActiveTenant();
    const form = await request.formData();
    const requestedPurpose = form.get("purpose");
    const purpose = requestedPurpose === "TICKET_IMAGE" || requestedPurpose === "TENANT_PROFILE" ? requestedPurpose : "TENANT_PAYMENT_SCREENSHOT";
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: { message: "Choose an image" } }, { status: 400 });
    if (file.size < 1 || file.size > 5 * 1024 * 1024) return Response.json({ error: { message: "Screenshots must be between 1 byte and 5 MB" } }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = detectImageContentType(bytes);
    if (!contentType) return Response.json({ error: { message: "Upload a valid JPEG, PNG or WebP image" } }, { status: 400 });
    if (!await PgModel.exists({ _id: pgId, status: "ACTIVE" })) return Response.json({ error: { message: "Your PG account is not available" } }, { status: 404 });
    const folder = purpose === "TICKET_IMAGE" ? "tickets" : purpose === "TENANT_PROFILE" ? "tenant-profiles" : "payment-submissions";
    const stored = await getStorageProvider().upload({ bytes, contentType, resourceType: "image", visibility: "private", folder: `nelemane/pgs/${pgId}/${folder}` });
    let asset;
    try {
      asset = await TemporaryAssetModel.create({
        ownerUserId: new Types.ObjectId(user.id), pgId: new Types.ObjectId(pgId), purpose,
        publicId: stored.publicId, url: stored.url, resourceType: stored.resourceType, visibility: "private",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      await getStorageProvider().delete(stored.publicId).catch(() => undefined);
      throw error;
    }
    const previewUrl = await getStorageProvider().getSignedUrl(stored.publicId, 60);
    return Response.json({ asset: { id: asset._id.toString(), previewUrl, expiresInSeconds: 60 } }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return Response.json({ error: { message: "The payment screenshot could not be uploaded" } }, { status: 500 });
  }
}
