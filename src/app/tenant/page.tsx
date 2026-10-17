import Link from "next/link";

import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { PgModel } from "@/server/db/models/pg";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel } from "@/server/db/models/room-type";

export const dynamic = "force-dynamic";

export default async function TenantDashboardPage() {
  const { tenant, pgId, user } = await requireActiveTenant();
  const [pg, room] = await Promise.all([
    PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name address.locality owner.phone").lean(),
    RoomModel.findOne({ _id: tenant.roomId, pgId }).select("roomNumber floor block roomTypeId").lean(),
  ]);
  const rentType = room ? await RoomTypeModel.findOne({ _id: room.roomTypeId, pgId }).select("name").lean() : null;
  return (
    <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident account</p>
      <h1 className="font-display text-primary mt-2 text-4xl font-medium">Welcome, {user.name}</h1>
      <p className="text-foreground/60 mt-2">{pg?.name ?? "Your PG"} · {pg?.address.locality ?? "Bengaluru"}</p>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="border-border rounded-2xl border bg-white p-5"><p className="text-foreground/55 text-sm">Your room</p><p className="font-display text-primary mt-2 text-2xl">{room?.roomNumber ?? "—"}</p><p className="text-foreground/55 mt-1 text-sm">{rentType?.name ?? "Room"}{room?.floor ? ` · Floor ${room.floor}` : ""}{room?.block ? ` · ${room.block}` : ""}</p></article>
        <article className="border-border rounded-2xl border bg-white p-5"><p className="text-foreground/55 text-sm">Monthly rent</p><p className="font-display text-primary mt-2 text-2xl">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(tenant.monthlyRent / 100)}</p><p className="text-foreground/55 mt-1 text-sm">Due dates are set by your PG</p></article>
        <article className="border-border rounded-2xl border bg-white p-5"><p className="text-foreground/55 text-sm">Account status</p><p className="font-display text-primary mt-2 text-2xl">Active</p><p className="text-foreground/55 mt-1 text-sm">Member since {tenant.joinedAt.toLocaleDateString("en-IN")}</p></article>
      </section>
      <section className="border-border mt-8 rounded-2xl border bg-white p-6 sm:p-8"><h2 className="font-display text-primary text-2xl">Rent payments</h2><p className="text-foreground/60 mt-2 max-w-2xl text-sm leading-6">See your monthly rent charges, review the PG’s payment instructions, register a transfer and track owner approvals.</p><Link href="/tenant/rent" className="bg-primary text-primary-foreground mt-5 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold">Open rent account</Link>{pg?.owner.phone && <a href={`tel:${pg.owner.phone}`} className="border-border ml-3 mt-5 inline-flex min-h-11 items-center rounded-xl border px-5 text-sm font-semibold">Call PG owner</a>}</section>
    </main>
  );
}
