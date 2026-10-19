import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSignedUrl: vi.fn() }));

vi.mock("@/server/providers/storage", () => ({
  getStorageProvider: () => ({ getSignedUrl: mocks.getSignedUrl }),
}));

import { privateImageResponse } from "@/server/providers/private-image-response";

describe("private image response", () => {
  beforeEach(() => {
    mocks.getSignedUrl.mockResolvedValue("https://storage.example/private-image");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("streams supported image data with private no-store headers", async () => {
    const response = await privateImageResponse("private-image-id");

    expect(mocks.getSignedUrl).toHaveBeenCalledWith("private-image-id", 60);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it("rejects a non-image upstream response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not an image", {
      status: 200,
      headers: { "content-type": "text/html" },
    })));

    const response = await privateImageResponse("private-image-id");

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { message: "Private image storage returned an unsupported image type" } });
  });

  it("returns a safe storage error when the upstream fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream failure")));

    const response = await privateImageResponse("private-image-id");

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: { message: "Private image could not be opened" } });
  });
});
