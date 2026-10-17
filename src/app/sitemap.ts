import type { MetadataRoute } from "next";

import { getEnv } from "@/lib/env";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { PUBLIC_PG_FILTER } from "@/server/public-pgs";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getEnv().APP_URL.replace(/\/$/, "");
  await connectToDatabase();
  const pgs = await PgModel.find(PUBLIC_PG_FILTER).select("slug updatedAt").sort({ updatedAt: -1 }).limit(10_000).lean();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/pgs`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [...staticRoutes, ...pgs.map((pg) => ({ url: `${baseUrl}/pgs/${encodeURIComponent(pg.slug)}`, lastModified: pg.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 }))];
}
