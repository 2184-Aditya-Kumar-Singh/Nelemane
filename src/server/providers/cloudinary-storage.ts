import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
import type {
  StorageProvider,
  StoredAsset,
  UploadRequest,
} from "@/server/providers/contracts";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const cloudinaryIdPrefix = "cld:";

interface CloudinaryId {
  visibility: "public" | "private";
  resourceType: "image" | "raw";
  format: string;
  publicId: string;
}

function encodeId(value: CloudinaryId): string {
  return `${cloudinaryIdPrefix}${value.visibility}:${value.resourceType}:${value.format}:${value.publicId}`;
}

function decodeId(value: string): CloudinaryId | null {
  if (!value.startsWith(cloudinaryIdPrefix)) return null;
  const parts = value.slice(cloudinaryIdPrefix.length).split(":");
  if (parts.length < 4 || !parts[3]) return null;
  const [visibility, resourceType, format, ...publicIdParts] = parts;
  if (
    (visibility !== "public" && visibility !== "private") ||
    (resourceType !== "image" && resourceType !== "raw") ||
    !/^[a-z0-9]{2,8}$/i.test(format)
  ) return null;
  return { visibility, resourceType, format, publicId: publicIdParts.join(":") };
}

function cloudinarySignature(parameters: Record<string, string>): string {
  const canonical = Object.entries(parameters)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const secret = getEnv().CLOUDINARY_API_SECRET;
  if (!secret) throw new Error("Cloudinary storage is not configured");
  return createHash("sha1")
    .update(`${canonical}${secret}`)
    .digest("hex");
}

function assertResponse<T extends object>(
  response: Response,
  payload: T,
): T {
  if (!response.ok) throw new Error("Cloudinary request failed");
  return payload;
}

export class CloudinaryStorageProvider implements StorageProvider {
  private readonly env = getEnv();

  constructor() {
    if (
      !this.env.CLOUDINARY_CLOUD_NAME ||
      !this.env.CLOUDINARY_API_KEY ||
      !this.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Cloudinary storage is not configured");
    }
  }

  async upload(request: UploadRequest): Promise<StoredAsset> {
    if (request.bytes.length === 0 || request.bytes.length > MAX_FILE_BYTES) {
      throw new Error("Files must be between 1 byte and 5 MB");
    }
    if (request.resourceType === "raw" && request.contentType !== "application/pdf") {
      throw new Error("Raw uploads are limited to private PDF documents");
    }
    if (request.resourceType === "image" && request.contentType === "application/pdf") {
      throw new Error("PDF files must use the raw resource type");
    }
    if (request.visibility === "public" && request.contentType === "application/pdf") {
      throw new Error("PDF documents cannot be uploaded as public files");
    }

    const folder = request.folder.replace(/[^a-zA-Z0-9/_-]/g, "_").slice(0, 120);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = randomUUID();
    const type = request.visibility === "private" ? "private" : "upload";
    const signature = cloudinarySignature({ folder, public_id: publicId, timestamp, type });
    const form = new FormData();
    form.set("file", new Blob([Uint8Array.from(request.bytes)], { type: request.contentType }), "upload");
    form.set("folder", folder);
    form.set("public_id", publicId);
    form.set("timestamp", timestamp);
    form.set("type", type);
    form.set("api_key", this.env.CLOUDINARY_API_KEY!);
    form.set("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.env.CLOUDINARY_CLOUD_NAME}/${request.resourceType}/upload`,
      { method: "POST", body: form, signal: AbortSignal.timeout(30_000) },
    );
    const payload = await response.json().catch(() => null) as
      | { secure_url?: string; public_id?: string; format?: string }
      | null;
    if (!response.ok || !payload?.secure_url || !payload.public_id || !payload.format) {
      throw new Error("Cloudinary upload failed");
    }

    return {
      publicId: encodeId({
        visibility: request.visibility,
        resourceType: request.resourceType,
        format: payload.format,
        publicId: payload.public_id,
      }),
      url: payload.secure_url,
      resourceType: request.resourceType,
      visibility: request.visibility,
    };
  }

  async getSignedUrl(publicId: string, expiresInSeconds: number): Promise<string> {
    const asset = decodeId(publicId);
    if (!asset) throw new Error("Stored asset identifier is invalid");
    if (asset.visibility === "public") {
      const deliveryType = "upload";
      return `https://res.cloudinary.com/${this.env.CLOUDINARY_CLOUD_NAME}/${asset.resourceType}/${deliveryType}/${asset.publicId}.${asset.format}`;
    }
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 60) {
      throw new Error("Signed private asset links must expire within 60 seconds");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const expiresAt = (Number(timestamp) + expiresInSeconds).toString();
    const parameters = {
      expires_at: expiresAt,
      format: asset.format,
      public_id: asset.publicId,
      timestamp,
    };
    const query = new URLSearchParams({
      ...parameters,
      signature: cloudinarySignature(parameters),
      api_key: this.env.CLOUDINARY_API_KEY!,
    });
    return `https://api.cloudinary.com/v1_1/${this.env.CLOUDINARY_CLOUD_NAME}/${asset.resourceType}/download?${query.toString()}`;
  }

  async delete(publicId: string): Promise<void> {
    const asset = decodeId(publicId);
    if (!asset) return;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const type = asset.visibility === "private" ? "private" : "upload";
    const parameters = {
      invalidate: "true",
      public_id: asset.publicId,
      timestamp,
      type,
    };
    const form = new URLSearchParams({
      ...parameters,
      api_key: this.env.CLOUDINARY_API_KEY!,
      signature: cloudinarySignature(parameters),
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.env.CLOUDINARY_CLOUD_NAME}/${asset.resourceType}/destroy`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(30_000),
      },
    );
    const payload = await response.json().catch(() => ({})) as { result?: string };
    assertResponse(response, payload);
    if (payload.result !== "ok" && payload.result !== "not found") {
      throw new Error("Cloudinary delete failed");
    }
  }
}
