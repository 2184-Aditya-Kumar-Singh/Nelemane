import Link from "next/link";

import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { PgModel } from "@/server/db/models/pg";
import { RoomModel } from "@/server/db/models/room";
import { RoomTypeModel } from "@/server/db/models/room-type";
import { MenuModel } from "@/server/db/models/menu";
import { normalizeMenuWeek } from "@/lib/menu-types";
import { MenuMealCard } from "@/components/menu-meal-card";
import { TicketModel } from "@/server/db/models/ticket";
import { RentChargeModel } from "@/server/db/models/rent-charge";
import { ensureRentChargesForMonth } from "@/server/payments/charges";
import { getIstMonthKey } from "@/server/payments/dates";
import { getIstMenuDay } from "@/server/menus/dates";

export const dynamic = "force-dynamic";

export default async function TenantDashboardPage() {
  const { tenant, pgId, user } = await requireActiveTenant();
  const [pg, room] = await Promise.all([
    PgModel.findOne({ _id: pgId, status: "ACTIVE" }).select("name address.locality owner.phone houseRules rentWindow").lean(),
    RoomModel.findOne({ _id: tenant.roomId, pgId }).select("roomNumber floor block roomTypeId").lean(),
  ]);
  if (pg) await ensureRentChargesForMonth({ pgId, month: getIstMonthKey(), window: pg.rentWindow });
  const [rentCharge, menu, openTickets] = await Promise.all([
    RentChargeModel.findOne({ pgId, tenantId: tenant._id, month: getIstMonthKey() }).lean(),
    MenuModel.findOne({ pgId }).lean(),
    TicketModel.countDocuments({ pgId, tenantId: tenant._id, status: { $in: ["OPEN", "IN_PROGRESS", "REOPENED", "RESOLVED_AWAITING_APPROVAL"] } }),
  ]);
  const todayMenu = normalizeMenuWeek(menu?.week)[getIstMenuDay()];
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
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="border-border rounded-2xl border bg-white p-5"><p className="text-foreground/55 text-sm">Rent due this month</p><p className="font-display text-primary mt-2 text-2xl">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.max(0, (rentCharge?.amount ?? tenant.monthlyRent) - (rentCharge?.paidAmount ?? 0)) / 100)}</p><Link href="/tenant/rent" className="text-primary mt-3 inline-block text-sm font-semibold underline">Pay now</Link></article>
        <article className="border-border rounded-2xl border bg-white p-5"><p className="text-foreground/55 text-sm">Open maintenance tickets</p><p className="font-display text-primary mt-2 text-2xl">{openTickets}</p><Link href="/tenant/tickets" className="text-primary mt-3 inline-block text-sm font-semibold underline">View tickets</Link></article>
        <article className="border-border rounded-2xl border bg-white p-5"><p className="text-foreground/55 text-sm">PG owner</p><p className="font-display text-primary mt-2 text-2xl">Contact</p>{pg?.owner.phone ? <a href={`tel:${pg.owner.phone}`} className="text-primary mt-3 inline-block text-sm font-semibold underline">Call {pg.owner.phone}</a> : <span className="text-foreground/55 mt-3 inline-block text-sm">Phone not available</span>}</article>
      </section>
      <section className="border-border mt-8 rounded-2xl border bg-white p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Today’s meals</p><h2 className="font-display text-primary mt-1 text-2xl">Menu</h2></div><Link href="/tenant/menu" className="text-primary text-sm font-semibold underline">Full week</Link></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(["breakfast", "lunch", "snacks", "dinner"] as const).map((meal) => <MenuMealCard key={meal} title={meal[0].toUpperCase() + meal.slice(1)} meal={todayMenu[meal]} />)}</div></section>
      <section className="border-border mt-5 rounded-2xl border bg-white p-6 sm:p-8"><h2 className="font-display text-primary text-2xl">House rules</h2><p className="text-foreground/65 mt-2 whitespace-pre-wrap text-sm leading-6">{pg?.houseRules?.trim() || "Your PG has not posted house rules yet."}</p><Link href="/tenant/profile" className="text-primary mt-4 inline-block text-sm font-semibold underline">Update your profile and PG rating</Link></section>
    </main>
  );
}
