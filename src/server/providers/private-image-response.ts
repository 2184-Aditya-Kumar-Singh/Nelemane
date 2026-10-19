import "server-only";

import { getStorageProvider } from "@/server/providers/storage";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function privateImageResponse(publicId: string): Promise<Response> {
  try {
    const signedUrl = await getStorageProvider().getSignedUrl(publicId, 60);
    const storedResponse = await fetch(signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!storedResponse.ok || !storedResponse.body) {
      return Response.json(
        { error: { message: `Private image storage returned ${storedResponse.status}` } },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const contentType = storedResponse.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!contentType || !allowedImageTypes.has(contentType)) {
      return Response.json(
        { error: { message: "Private image storage returned an unsupported image type" } },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return new Response(storedResponse.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: { message: "Private image could not be opened" } },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
