import "server-only";

import { getEnv } from "@/lib/env";
import { CloudinaryStorageProvider } from "@/server/providers/cloudinary-storage";
import { LocalDevelopmentStorageProvider } from "@/server/providers/local-storage";
import type { StorageProvider } from "@/server/providers/contracts";

let provider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    const env = getEnv();
    provider = env.CLOUDINARY_CLOUD_NAME
      ? new CloudinaryStorageProvider()
      : new LocalDevelopmentStorageProvider();
  }
  return provider;
}
