import type { MetadataRoute } from "next";

import { getEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getEnv().APP_URL.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/owner", "/tenant", "/dashboard", "/api", "/ticket-approval", "/login", "/forgot-password", "/reset-password"] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
