import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, Star } from "lucide-react";

import { PgModel } from "@/server/db/models/pg";
import { PUBLIC_PG_FILTER } from "@/server/public-pgs";
import { RoomTypeModel } from "@/server/db/models/room-type";
import { ReviewModel } from "@/server/db/models/review";
import { connectToDatabase } from "@/server/db/connection";
import { formatRupees } from "@/server/public-pgs";
import { getEnv } from "@/lib/env";
import { PgGallery } from "./pg-gallery";

export const dynamic = "force-dynamic";

async function getPg(slug: string) {
  await connectToDatabase();
  return PgModel.findOne({ slug, ...PUBLIC_PG_FILTER }).select("name slug owner.name owner.phone address description gender facilities customFacilities houseRules photos profilePhoto ratingAvg ratingCount").lean();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pg = await getPg(slug);
  if (!pg) return { title: "PG not found" };
  const description = pg.description.trim().slice(0, 155) || `${pg.name} paying guest accommodation in ${pg.address.locality}, Bengaluru.`;
  const image = pg.profilePhoto?.url || pg.photos[0]?.url;
  return {
    title: `${pg.name} · ${pg.address.locality}`,
    description,
    alternates: { canonical: `/pgs/${pg.slug}` },
    openGraph: { title: `${pg.name} in ${pg.address.locality}`, description, type: "article", ...(image ? { images: [{ url: image, alt: `${pg.name} in Bengaluru` }] } : {}) },
  };
}

function mapsUrl(address: { line1: string; locality: string; city: string; pincode: string; mapsUrl?: string; lat?: number; lng?: number }) {
  const query = address.lat !== undefined && address.lng !== undefined ? `${address.lat},${address.lng}` : `${address.line1}, ${address.locality}, ${address.city} ${address.pincode}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default async function PgDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pg = await getPg(slug);
  if (!pg) notFound();
  const [roomTypes, reviews, ratingDistribution] = await Promise.all([
    RoomTypeModel.find({ pgId: pg._id }).sort({ rent: 1, sharing: 1 }).lean(),
    ReviewModel.find({ pgId: pg._id, comment: { $exists: true, $ne: "" } }).sort({ createdAt: -1 }).limit(40).lean(),
    ReviewModel.aggregate<{ _id: number; count: number }>([
      { $match: { pgId: pg._id } }, { $group: { _id: "$rating", count: { $sum: 1 } } }, { $sort: { _id: -1 } },
    ]),
  ]);
  const distribution = new Map(ratingDistribution.map((row) => [row._id, row.count]));
  const facilities = [...pg.facilities, ...pg.customFacilities];
  const photos = [...pg.photos.map((photo) => ({ url: photo.url, caption: photo.caption })), ...(pg.profilePhoto ? [{ url: pg.profilePhoto.url, caption: `${pg.name} profile photo` }] : [])]
    .filter((photo, index, items) => items.findIndex((candidate) => candidate.url === photo.url) === index);
  const phone = pg.owner.phone.replace(/[^\d+]/g, "");
  const phoneDigits = pg.owner.phone.replace(/\D/g, "").replace(/^0/, "");
  const whatsappPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
  const mapLink = mapsUrl(pg.address);
  const baseUrl = getEnv().APP_URL;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "LodgingBusiness", name: pg.name,
    description: pg.description || `${pg.name} paying guest accommodation in ${pg.address.locality}, Bengaluru.`,
    url: new URL(`/pgs/${pg.slug}`, baseUrl).toString(), telephone: pg.owner.phone,
    image: photos.map((photo) => photo.url),
    address: { "@type": "PostalAddress", streetAddress: pg.address.line1, addressLocality: pg.address.locality, addressRegion: pg.address.state, postalCode: pg.address.pincode, addressCountry: "IN" },
    ...(pg.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: pg.ratingAvg, reviewCount: pg.ratingCount, bestRating: 5, worstRating: 1 } } : {}),
  };
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd }} /><nav aria-label="Breadcrumb" className="mb-5 text-sm text-foreground/55"><Link href="/pgs" className="hover:text-primary hover:underline">PGs in Bengaluru</Link><span aria-hidden="true" className="mx-2">/</span><span className="text-foreground">{pg.address.locality}</span></nav><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">{pg.address.locality} · Bengaluru</p><h1 className="font-display text-primary mt-2 text-4xl font-medium sm:text-5xl">{pg.name}</h1><p className="text-foreground/65 mt-3 flex items-center gap-2 text-sm"><MapPin aria-hidden="true" className="size-4" />{pg.address.locality}, Bengaluru · <a href={mapLink} target="_blank" rel="noreferrer" className="text-primary font-semibold underline">Open in Google Maps</a></p></div><div className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 dark:bg-white/[0.04]"><Star aria-hidden="true" className="size-5 fill-amber-400 text-amber-500" /><span className="font-semibold">{pg.ratingCount ? pg.ratingAvg.toFixed(1) : "New"}</span><span className="text-foreground/55 text-sm">· {pg.ratingCount} {pg.ratingCount === 1 ? "review" : "reviews"}</span></div></div><div className="mt-6"><PgGallery name={pg.name} photos={photos} /></div>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-9"><section><h2 className="font-display text-primary text-2xl">About this PG</h2><p className="text-foreground/70 mt-3 whitespace-pre-wrap text-sm leading-7">{pg.description || "A welcoming place to stay in Bengaluru."}</p></section><section><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-primary text-2xl">Room types and rent</h2><p className="text-foreground/55 mt-1 text-sm">Monthly rent and deposit per resident.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold">{pg.gender === "BOYS" ? "Men" : pg.gender === "GIRLS" ? "Women" : "All genders"}</span></div>{roomTypes.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{roomTypes.map((room) => <article key={room._id.toString()} className="overflow-hidden rounded-2xl border bg-white dark:bg-white/[0.04]">{room.photos[0] && <div className="relative aspect-[1.8] bg-muted"><Image src={room.photos[0].url} alt={`${room.name} room photo`} fill sizes="(max-width: 768px) 100vw, 45vw" unoptimized className="object-cover" /></div>}<div className="p-5"><h3 className="font-display text-primary text-xl">{room.name}</h3><p className="text-foreground/55 mt-1 text-sm">{room.sharing === 1 ? "Single occupancy" : `${room.sharing} sharing`}{room.ac ? " · AC" : " · Non-AC"}{room.attachedBath ? " · Attached bathroom" : ""}</p>{room.description && <p className="text-foreground/65 mt-3 text-sm leading-6">{room.description}</p>}<div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/60 p-3"><p className="text-foreground/50 text-xs">Rent / month</p><p className="text-primary mt-1 font-semibold">{formatRupees(room.rent)}</p></div><div className="rounded-xl bg-muted/60 p-3"><p className="text-foreground/50 text-xs">Deposit</p><p className="text-primary mt-1 font-semibold">{formatRupees(room.deposit)}</p></div></div>{room.amenities.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{room.amenities.map((amenity) => <span key={amenity} className="rounded-full border px-2.5 py-1 text-[11px]">{amenity}</span>)}</div>}</div></article>)}</div> : <p className="text-foreground/60 mt-4 rounded-2xl border border-dashed p-5 text-sm">Room and rent details are available by contacting the owner.</p>}</section><section><h2 className="font-display text-primary text-2xl">Facilities</h2>{facilities.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{facilities.map((facility) => <li key={facility} className="flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm dark:bg-white/[0.04]"><span aria-hidden="true" className="text-success">✓</span>{facility}</li>)}</ul> : <p className="text-foreground/60 mt-3 text-sm">Contact the owner for facility details.</p>}</section><section><h2 className="font-display text-primary text-2xl">House rules</h2><p className="text-foreground/70 mt-3 whitespace-pre-wrap rounded-2xl border bg-white p-5 text-sm leading-7 dark:bg-white/[0.04]">{pg.houseRules || "Please contact the owner for house rules."}</p></section><section><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-primary text-2xl">Resident ratings</h2><p className="text-foreground/55 mt-1 text-sm">{pg.ratingCount ? `${pg.ratingAvg.toFixed(1)} out of 5 from ${pg.ratingCount} resident ratings` : "No resident ratings yet"}</p></div><Link href="/login" className="text-primary text-sm font-semibold underline">Resident? Sign in to rate</Link></div><div className="mt-4 max-w-xl space-y-2">{[5, 4, 3, 2, 1].map((rating) => { const count = distribution.get(rating) ?? 0; const width = pg.ratingCount ? `${Math.round((count / pg.ratingCount) * 100)}%` : "0%"; return <div key={rating} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 text-xs"><span>{rating} star</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-400" style={{ width }} /></div><span className="text-right text-foreground/55">{count}</span></div>; })}</div>{reviews.length ? <div className="mt-5 grid gap-3">{reviews.map((review) => <article key={review._id.toString()} className="rounded-2xl border bg-white p-5 dark:bg-white/[0.04]"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1 text-sm font-semibold"><Star aria-hidden="true" className="size-4 fill-amber-400 text-amber-500" />{review.rating}/5</span><time className="text-foreground/45 text-xs">{review.editedAt.toLocaleDateString("en-IN")}</time></div>{review.comment && <p className="text-foreground/70 mt-3 text-sm leading-6">{review.comment}</p>}<p className="text-foreground/45 mt-2 text-xs">Verified resident</p></article>)}</div> : <p className="text-foreground/60 mt-5 text-sm">Resident reviews will appear here.</p>}</section></div>
    <aside className="h-fit rounded-3xl border bg-white p-5 shadow-sm lg:sticky lg:top-6 dark:bg-white/[0.04]"><p className="text-foreground/55 text-sm">Questions or want to visit?</p><h2 className="font-display text-primary mt-1 text-2xl">Contact the owner</h2><p className="mt-4 font-semibold">{pg.owner.name}</p><p className="text-foreground/60 mt-1 text-sm">{pg.address.locality}, Bengaluru</p><a href={`tel:${phone}`} className="bg-primary text-primary-foreground mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"><Phone aria-hidden="true" className="size-4" />Call {pg.owner.phone}</a><a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold hover:bg-muted">Message on WhatsApp</a><p className="text-foreground/45 mt-4 text-xs leading-5">Nelemane helps you explore. Confirm availability, terms and rent directly with the PG owner before paying.</p></aside></div></main>;
}
