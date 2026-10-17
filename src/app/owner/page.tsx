import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";

import { requirePgScope, requireRoles } from "@/server/auth/authorization";
import { connectToDatabase } from "@/server/db/connection";
import { PgModel } from "@/server/db/models/pg";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel } from "@/server/db/models/room-type";
import { TenantModel } from "@/server/db/models/tenant";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  const user = await requireRoles("PG_OWNER");
  const pgId = requirePgScope(user);
  await connectToDatabase();
  const [pg, roomCount, roomTypeCount, beds, tenantCount] = await Promise.all([
    PgModel.findOne({ _id: pgId, status: "ACTIVE" }).lean(),
    RoomModel.countDocuments({ pgId }),
    RoomTypeModel.countDocuments({ pgId }),
    RoomModel.aggregate<{ total: number }>([
      { $match: { pgId: new Types.ObjectId(pgId) } },
      { $group: { _id: null, total: { $sum: "$capacity" } } },
    ]),
    TenantModel.countDocuments({ pgId, status: "ACTIVE" }),
  ]);
  if (!pg) notFound();
  const missing = [
    !pg.profilePhoto,
    pg.description.trim().length < 40,
    !pg.facilities.length && !pg.customFacilities.length,
    !pg.photos.length,
    !pg.houseRules.trim(),
    !roomTypeCount,
    !pg.paymentDetails.qrImage && !pg.paymentDetails.bank,
  ].filter(Boolean).length;
  const completeness = Math.round(((7 - missing) / 7) * 100);
  const cardData = [
    { title: "Room types", value: roomTypeCount, href: "/owner/rooms" },
    { title: "Rooms", value: roomCount, href: "/owner/rooms" },
    { title: "Beds configured", value: beds[0]?.total ?? 0, href: "/owner/rooms" },
    { title: "Active tenants", value: tenantCount, href: "/owner/tenants" },
    { title: "Profile completeness", value: `${completeness}%`, href: "/owner/pg-details" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Your PG workspace</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Welcome, {user.name}</h1><p className="text-foreground/60 mt-2 text-sm">{pg.name} · {pg.address.locality}, Bengaluru</p></div>
        <Link href="/owner/pg-details" className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold">Edit PG details</Link>
      </div>
      {pg.subscription.status !== "ACTIVE" && <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Your platform subscription is {pg.subscription.status.toLowerCase()}. Contact Nelemane support if you need help.</p>}
      <section aria-label="PG setup overview" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cardData.map((card) => <Link key={card.title} href={card.href} className="border-border rounded-2xl border bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5"><p className="text-foreground/55 text-sm font-medium">{card.title}</p><p className="font-display text-primary mt-3 text-4xl font-medium">{typeof card.value === "number" ? card.value.toLocaleString("en-IN") : card.value}</p><span className="text-primary mt-3 inline-block text-xs font-semibold">Manage →</span></Link>)}
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="border-border rounded-2xl border bg-white p-6"><h2 className="font-display text-primary text-2xl font-medium">Set up your space</h2><p className="text-foreground/55 mt-2 text-sm leading-6">Add your facilities, photos, rules and payment instructions. Then define room types and rooms so the occupancy board is ready when you add residents.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/owner/pg-details" className="min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-muted">Complete PG profile</Link><Link href="/owner/rooms" className="min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-muted">Add room types and rooms</Link></div></section>
        <section className="border-border rounded-2xl border bg-white p-6"><h2 className="font-display text-primary text-2xl font-medium">Occupancy preview</h2><p className="text-foreground/55 mt-2 text-sm leading-6">{roomCount ? `${tenantCount} of ${beds[0]?.total ?? 0} configured beds are occupied across ${roomCount} rooms.` : "Create room types and rooms to start tracking available beds."}</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/owner/rooms" className="text-primary text-sm font-semibold hover:underline">Open room board →</Link><Link href="/owner/tenants" className="text-primary text-sm font-semibold hover:underline">Manage tenants →</Link></div></section>
      </div>
    </main>
  );
}
