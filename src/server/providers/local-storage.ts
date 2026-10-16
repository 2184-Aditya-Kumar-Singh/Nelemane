import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { getEnv } from "@/lib/env";
import type {
  StorageProvider,
  StoredAsset,
  UploadRequest,
} from "@/server/providers/contracts";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const assetIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assetMetadataSchema = z.object({
  publicId: z.string().regex(assetIdPattern),
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]),
  resourceType: z.enum(["image", "raw"]),
  visibility: z.enum(["public", "private"]),
  folder: z.string(),
});

type SupportedContentType = z.infer<typeof assetMetadataSchema>["contentType"];

export type LocalAsset = z.infer<typeof assetMetadataSchema> & {
  bytes: Buffer;
};

function detectContentType(bytes: Buffer): SupportedContentType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }

  return null;
}

function signatureFor(publicId: string, expiresAt: number): string {
  return createHmac("sha256", getEnv().AUTH_SECRET)
    .update(`${publicId}.${expiresAt}`)
    .digest("hex");
}

export function verifyLocalAssetSignature(
  publicId: string,
  expiresAtValue: string | null,
  signature: string | null,
): boolean {
  if (!expiresAtValue || !signature || !assetIdPattern.test(publicId)) {
    return false;
  }

  const expiresAt = Number(expiresAtValue);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + 60 ||
    !/^[0-9a-f]{64}$/i.test(signature)
  ) {
    return false;
  }

  const expected = Buffer.from(signatureFor(publicId, expiresAt), "hex");
  const provided = Buffer.from(signature, "hex");
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

export async function readLocalAsset(
  publicId: string,
): Promise<LocalAsset | null> {
  if (!assetIdPattern.test(publicId)) {
    return null;
  }

  try {
    const metadataText = await readFile(
      path.join(process.cwd(), ".local-storage", `${publicId}.json`),
      "utf8",
    );
    const metadataResult = assetMetadataSchema.safeParse(
      JSON.parse(metadataText) as unknown,
    );
    if (!metadataResult.success || metadataResult.data.publicId !== publicId) {
      return null;
    }

    const bytes = await readFile(
      path.join(process.cwd(), ".local-storage", publicId),
    );
    if (detectContentType(bytes) !== metadataResult.data.contentType) {
      return null;
    }

    return { ...metadataResult.data, bytes };
  } catch {
    return null;
  }
}

export class LocalDevelopmentStorageProvider implements StorageProvider {
  constructor() {
    if (getEnv().NODE_ENV === "production") {
      throw new Error("Local development storage is disabled in production");
    }
  }

  async upload(request: UploadRequest): Promise<StoredAsset> {
    if (request.bytes.length === 0 || request.bytes.length > MAX_FILE_BYTES) {
      throw new Error("Files must be between 1 byte and 5 MB");
    }

    const detectedType = detectContentType(request.bytes);
    if (!detectedType || detectedType !== request.contentType) {
      throw new Error(
        "The file content does not match an allowed image or PDF type",
      );
    }

    if (
      request.resourceType === "image" &&
      detectedType === "application/pdf"
    ) {
      throw new Error("PDF files must use the raw resource type");
    }

    if (request.resourceType === "raw" && detectedType !== "application/pdf") {
      throw new Error("Raw uploads are limited to private PDF documents");
    }

    if (request.visibility === "public" && detectedType === "application/pdf") {
      throw new Error("PDF documents cannot be uploaded as public files");
    }

    const publicId = randomUUID();
    await mkdir(path.join(process.cwd(), ".local-storage"), {
      recursive: true,
    });

    const safeFolder = request.folder
      .replace(/[^a-zA-Z0-9/_-]/g, "_")
      .slice(0, 120);
    const metadata = {
      publicId,
      contentType: detectedType,
      resourceType: request.resourceType,
      visibility: request.visibility,
      folder: safeFolder,
    } satisfies z.infer<typeof assetMetadataSchema>;

    const bytesPath = path.join(process.cwd(), ".local-storage", publicId);
    const metadataPath = path.join(
      process.cwd(),
      ".local-storage",
      `${publicId}.json`,
    );
    await writeFile(bytesPath, request.bytes, { flag: "wx" });

    try {
      await writeFile(metadataPath, JSON.stringify(metadata), { flag: "wx" });
    } catch (error: unknown) {
      await unlink(bytesPath).catch(() => undefined);
      throw error;
    }

    const url =
      request.visibility === "public"
        ? new URL(`/api/dev-media/${publicId}`, getEnv().APP_URL).toString()
        : `dev-private://${publicId}`;

    return {
      publicId,
      url,
      resourceType: request.resourceType,
      visibility: request.visibility,
    };
  }

  async getSignedUrl(
    publicId: string,
    expiresInSeconds: number,
  ): Promise<string> {
    if (
      !Number.isInteger(expiresInSeconds) ||
      expiresInSeconds < 1 ||
      expiresInSeconds > 60
    ) {
      throw new Error(
        "Development private asset links must expire within 60 seconds",
      );
    }

    const asset = await readLocalAsset(publicId);
    if (!asset || asset.visibility !== "private") {
      throw new Error("Private asset was not found");
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const url = new URL(`/api/dev-media/${publicId}`, getEnv().APP_URL);
    url.searchParams.set("expiresAt", String(expiresAt));
    url.searchParams.set("signature", signatureFor(publicId, expiresAt));
    return url.toString();
  }

  async delete(publicId: string): Promise<void> {
    if (!assetIdPattern.test(publicId)) {
      return;
    }

    await Promise.all([
      unlink(path.join(process.cwd(), ".local-storage", publicId)).catch(
        () => undefined,
      ),
      unlink(
        path.join(process.cwd(), ".local-storage", `${publicId}.json`),
      ).catch(() => undefined),
    ]);
  }
}
