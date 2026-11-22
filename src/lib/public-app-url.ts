import "server-only";

const DEFAULT_PRODUCTION_APP_URL = "https://nelemane.vercel.app";

export function getPublicAppUrl(configuredUrl?: string): URL | undefined {
  const parsedUrl = parseUrl(configuredUrl);

  if (process.env.NODE_ENV !== "production") {
    return parsedUrl;
  }

  if (parsedUrl && isPublicHttpsUrl(parsedUrl)) {
    return parsedUrl;
  }

  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionHost) {
    const candidate = /^https?:\/\//i.test(vercelProductionHost)
      ? vercelProductionHost
      : `https://${vercelProductionHost}`;
    const vercelUrl = parseUrl(candidate);

    if (vercelUrl && isPublicHttpsUrl(vercelUrl)) {
      return vercelUrl;
    }
  }

  return new URL(DEFAULT_PRODUCTION_APP_URL);
}

export function normalizeAuthUrlEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const configuredAuthUrl =
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.APP_URL;
  const publicUrl = getPublicAppUrl(configuredAuthUrl);

  if (!publicUrl) {
    return;
  }

  // Auth.js uses these values as the request origin when building redirects.
  process.env.AUTH_URL = publicUrl.origin;
  process.env.NEXTAUTH_URL = publicUrl.origin;

  const internalUrl = parseUrl(process.env.NEXTAUTH_URL_INTERNAL);
  if (internalUrl && isLoopbackHost(internalUrl.hostname)) {
    process.env.NEXTAUTH_URL_INTERNAL = publicUrl.origin;
  }
}

function parseUrl(value?: string): URL | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function isPublicHttpsUrl(url: URL): boolean {
  return url.protocol === "https:" && !isLoopbackHost(url.hostname);
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.")
  );
}
