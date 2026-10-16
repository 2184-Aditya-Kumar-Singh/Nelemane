import type { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import {
  readLocalAsset,
  verifyLocalAssetSignature,
} from "@/server/providers/local-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  if (getEnv().NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const { assetId } = await context.params;
  const asset = await readLocalAsset(assetId);
  if (!asset) {
    return new Response(null, { status: 404 });
  }

  if (asset.visibility === "private") {
    const url = new URL(request.url);
    const isAuthorized = verifyLocalAssetSignature(
      assetId,
      url.searchParams.get("expiresAt"),
      url.searchParams.get("signature"),
    );

    if (!isAuthorized) {
      return new Response(null, { status: 404 });
    }
  }

  const body = new ArrayBuffer(asset.bytes.byteLength);
  new Uint8Array(body).set(asset.bytes);

  return new Response(body, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control":
        asset.visibility === "private"
          ? "private, no-store"
          : "public, max-age=3600, immutable",
    },
  });
}
