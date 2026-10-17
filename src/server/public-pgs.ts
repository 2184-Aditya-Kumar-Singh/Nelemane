import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/server/db/connection";
import { PgModel, type PgRecord } from "@/server/db/models/pg";
import { RoomTypeModel } from "@/server/db/models/room-type";

export const PUBLIC_PG_FILTER = { status: "ACTIVE", "subscription.status": "ACTIVE", isListed: true } as const;

export type PublicPgCardData = {
  id: string;
  slug: string;
  name: string;
  locality: string;
  description: string;
  gender: PgRecord["gender"];
  imageUrl: string;
  ratingAvg: number;
  ratingCount: number;
  startingRentPaise: number | null;
  facilities: string[];
};

export async function publicPgsByIds(ids?: Types.ObjectId[], limit?: number) {
  await connectToDatabase();
  let query = PgModel.find({ ...PUBLIC_PG_FILTER, ...(ids ? { _id: { $in: ids } } : {}) })
    .select("name slug address.locality description gender facilities customFacilities profilePhoto photos ratingAvg ratingCount createdAt updatedAt address.city")
    .sort({ ratingAvg: -1, ratingCount: -1, createdAt: -1 });
  if (limit) query = query.limit(limit);
  return query.lean();
}

export async function minimumRents(pgIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (!pgIds.length) return new Map();
  const rows = await RoomTypeModel.aggregate<{ _id: Types.ObjectId; startingRent: number }>([
    { $match: { pgId: { $in: pgIds } } },
    { $group: { _id: "$pgId", startingRent: { $min: "$rent" } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.startingRent]));
}

export function publicPgCard(pg: Awaited<ReturnType<typeof publicPgsByIds>>[number], startingRentPaise: number | null): PublicPgCardData {
  return {
    id: pg._id.toString(), slug: pg.slug, name: pg.name, locality: pg.address.locality,
    description: pg.description, gender: pg.gender, imageUrl: pg.profilePhoto?.url ?? pg.photos[0]?.url ?? "",
    ratingAvg: pg.ratingAvg, ratingCount: pg.ratingCount, startingRentPaise,
    facilities: [...pg.facilities, ...pg.customFacilities].slice(0, 5),
  };
}

export function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}
