import type { Metadata } from "next";
import type { QueryFilter, Types } from "mongoose";
import Link from "next/link";

import { PG_FACILITIES } from "@/lib/owner-schemas";
import { PublicPgCard } from "@/app/_components/public-pg-card";
import { PgModel, type PgRecord } from "@/server/db/models/pg";
import { RoomTypeModel, type RoomTypeRecord } from "@/server/db/models/room-type";
import { connectToDatabase } from "@/server/db/connection";
import { minimumRents, publicPgCard } from "@/server/public-pgs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Find a PG in Bengaluru",
  description: "Compare paying guest homes in Bengaluru by area, rent, room sharing, facilities and resident ratings.",
  alternates: { canonical: "/pgs" },
};

const PAGE_SIZE = 12;
const GENDERS = ["BOYS", "GIRLS", "COED"] as const;
type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function many(value: string | string[] | undefined): string[] { return Array.isArray(value) ? value : value ? [value] : []; }
function amount(value: string): number | null { return /^\d{1,7}$/.test(value) ? Math.min(Number(value), 1_000_000) : null; }
function escaped(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function queryForPage(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  query.set("page", String(page));
  return `/pgs?${query.toString()}`;
}

export default async function PgListingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const locality = one(params.locality).trim().slice(0, 80);
  const gender = GENDERS.includes(one(params.gender) as (typeof GENDERS)[number]) ? one(params.gender) : "";
  const sharingValue = one(params.sharing);
  const sharing = /^[1-6]$/.test(sharingValue) ? Number(sharingValue) : null;
  const minRent = amount(one(params.minRent));
  const maxRent = amount(one(params.maxRent));
  const minRatingText = one(params.minRating);
  const minRatingValue = minRatingText ? Number(minRatingText) : Number.NaN;
  const minRating = Number.isFinite(minRatingValue) && minRatingValue >= 0 && minRatingValue <= 5 ? minRatingValue : null;
  await connectToDatabase();
  const customFacilities = await PgModel.distinct("customFacilities", { status: "ACTIVE", "subscription.status": "ACTIVE", isListed: true });
  const facilityOptions = [...new Set([...PG_FACILITIES, ...customFacilities.filter((facility): facility is string => typeof facility === "string" && facility.length <= 60)])];
  const selectedFacilities = many(params.facility).filter((facility) => facilityOptions.includes(facility)).slice(0, 8);
  const sort = ["rating", "rent_low", "rent_high", "newest"].includes(one(params.sort)) ? one(params.sort) : "rating";
  const requestedPage = /^[1-9]\d{0,3}$/.test(one(params.page)) ? Number(one(params.page)) : 1;

  const filter: QueryFilter<PgRecord> = { status: "ACTIVE", "subscription.status": "ACTIVE", isListed: true };
  if (locality) filter["address.locality"] = new RegExp(escaped(locality), "i");
  if (gender) filter.gender = gender as PgRecord["gender"];
  if (minRating !== null) filter.ratingAvg = { $gte: minRating };
  if (selectedFacilities.length) filter.$and = selectedFacilities.map((facility) => ({ $or: [{ facilities: facility }, { customFacilities: facility }] }));

  const roomTypeFilter: QueryFilter<RoomTypeRecord> = {};
  if (sharing) roomTypeFilter.sharing = sharing;
  if (minRent !== null || maxRent !== null) {
    const rent: { $gte?: number; $lte?: number } = {};
    if (minRent !== null) rent.$gte = minRent * 100;
    if (maxRent !== null) rent.$lte = maxRent * 100;
    roomTypeFilter.rent = rent;
  }
  let allowedPgIds: Types.ObjectId[] | null = null;
  if (sharing || minRent !== null || maxRent !== null) {
    allowedPgIds = await RoomTypeModel.distinct("pgId", roomTypeFilter) as Types.ObjectId[];
    filter._id = { $in: allowedPgIds };
  }
  const total = await PgModel.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  let pgs;
  if (sort === "rent_low" || sort === "rent_high") {
    const candidateIds = allowedPgIds ?? await PgModel.find(filter).distinct("_id") as Types.ObjectId[];
    const rents = await RoomTypeModel.aggregate<{ _id: Types.ObjectId; startingRent: number }>([
      { $match: { pgId: { $in: candidateIds } } },
      { $group: { _id: "$pgId", startingRent: { $min: "$rent" } } },
    ]);
    const rentMap = new Map(rents.map((row) => [row._id.toString(), row.startingRent]));
    const orderedIds = [...candidateIds].sort((left, right) => {
      const leftRent = rentMap.get(left.toString());
      const rightRent = rentMap.get(right.toString());
      if (leftRent === undefined) return rightRent === undefined ? 0 : 1;
      if (rightRent === undefined) return -1;
      return (sort === "rent_low" ? leftRent - rightRent : rightRent - leftRent) || left.toString().localeCompare(right.toString());
    });
    const ids = orderedIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const documents = await PgModel.find({ ...filter, _id: { $in: ids } }).select("name slug address.locality description gender facilities customFacilities profilePhoto photos ratingAvg ratingCount createdAt address.city").lean();
    const documentMap = new Map(documents.map((pg) => [pg._id.toString(), pg]));
    pgs = ids.map((id) => documentMap.get(id.toString())).filter((pg): pg is NonNullable<typeof pg> => Boolean(pg));
  } else {
    pgs = await PgModel.find(filter).select("name slug address.locality description gender facilities customFacilities profilePhoto photos ratingAvg ratingCount createdAt address.city").sort(sort === "newest" ? { createdAt: -1 } : { ratingAvg: -1, ratingCount: -1, createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean();
  }
  const startingRents = await minimumRents(pgs.map((pg) => pg._id));
  const cards = pgs.map((pg) => publicPgCard(pg, startingRents.get(pg._id.toString()) ?? null));
  const filtersActive = Boolean(locality || gender || sharing || minRent !== null || maxRent !== null || minRating !== null || selectedFacilities.length);

  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12"><header className="max-w-3xl"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Bengaluru stays</p><h1 className="font-display text-primary mt-2 text-4xl font-medium sm:text-5xl">Find a PG that feels like yours.</h1><p className="text-foreground/65 mt-3 leading-7">Explore listed paying guest homes, compare room types and find the right neighbourhood for your routine.</p></header><div className="mt-8 grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]"><aside className="rounded-2xl border bg-white p-5 dark:bg-white/[0.04]"><div className="flex items-center justify-between"><h2 className="font-display text-primary text-xl">Filters</h2>{filtersActive && <Link href="/pgs" className="text-primary text-xs font-semibold underline">Clear</Link>}</div><form action="/pgs" method="get" className="mt-4 space-y-4"><label className="block text-sm font-semibold">Area<input name="locality" type="search" maxLength={80} defaultValue={locality} placeholder="e.g. Koramangala" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 font-normal" /></label><label className="block text-sm font-semibold">Gender<select name="gender" defaultValue={gender} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 font-normal"><option value="">Any</option><option value="BOYS">Men</option><option value="GIRLS">Women</option><option value="COED">All genders</option></select></label><fieldset><legend className="text-sm font-semibold">Monthly rent per bed (₹)</legend><div className="mt-1 grid grid-cols-2 gap-2"><label className="text-xs text-foreground/60">Minimum<input name="minRent" inputMode="numeric" defaultValue={one(params.minRent)} placeholder="Any" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-2 text-sm text-foreground" /></label><label className="text-xs text-foreground/60">Maximum<input name="maxRent" inputMode="numeric" defaultValue={one(params.maxRent)} placeholder="Any" className="mt-1 min-h-10 w-full rounded-lg border bg-background px-2 text-sm text-foreground" /></label></div></fieldset><label className="block text-sm font-semibold">Room sharing<select name="sharing" defaultValue={sharing?.toString() ?? ""} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 font-normal"><option value="">Any</option>{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count === 1 ? "Single" : `${count} sharing`}</option>)}</select></label><label className="block text-sm font-semibold">Minimum rating<select name="minRating" defaultValue={minRating?.toString() ?? ""} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 font-normal"><option value="">Any rating</option>{[3, 3.5, 4, 4.5].map((value) => <option key={value} value={value}>{value}+ stars</option>)}</select></label><fieldset><legend className="text-sm font-semibold">Facilities</legend><div className="mt-2 max-h-60 space-y-2 overflow-y-auto">{facilityOptions.map((facility) => <label key={facility} className="flex min-h-8 items-center gap-2 text-xs"><input type="checkbox" name="facility" value={facility} defaultChecked={selectedFacilities.includes(facility)} className="size-4 accent-primary" />{facility}</label>)}</div></fieldset><label className="block text-sm font-semibold">Sort by<select name="sort" defaultValue={sort} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 font-normal"><option value="rating">Top rated</option><option value="rent_low">Rent: low to high</option><option value="rent_high">Rent: high to low</option><option value="newest">Newest listed</option></select></label><button className="bg-primary text-primary-foreground min-h-11 w-full rounded-xl px-4 text-sm font-semibold">Show PGs</button></form></aside><section aria-label="PG results"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-foreground/60 text-sm"><strong className="text-foreground">{total.toLocaleString("en-IN")}</strong> {total === 1 ? "PG found" : "PGs found"}{filtersActive && " for your filters"}</p><span className="text-foreground/50 text-xs">Page {page} of {pages}</span></div>{cards.length ? <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{cards.map((pg) => <PublicPgCard key={pg.id} pg={pg} />)}</div> : <div className="mt-4 rounded-3xl border border-dashed bg-white p-8 text-center dark:bg-white/[0.04]"><h2 className="font-display text-primary text-2xl">No PGs match these filters yet.</h2><p className="text-foreground/60 mt-2 text-sm">Try a nearby area or widen your rent range.</p><Link href="/pgs" className="text-primary mt-4 inline-flex min-h-10 items-center text-sm font-semibold underline">Clear filters</Link></div>}{pages > 1 && <nav aria-label="PG result pages" className="mt-7 flex items-center justify-center gap-4"><Link aria-disabled={page <= 1} href={queryForPage(params, Math.max(1, page - 1))} className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-primary"}`}>Previous</Link><span className="text-foreground/60 text-sm">{page} / {pages}</span><Link aria-disabled={page >= pages} href={queryForPage(params, Math.min(pages, page + 1))} className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold ${page >= pages ? "pointer-events-none opacity-40" : "hover:border-primary"}`}>Next</Link></nav>}</section></div></main>;
}
