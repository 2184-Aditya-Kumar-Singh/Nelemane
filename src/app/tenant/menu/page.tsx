import { requireActiveTenant } from "@/server/auth/tenant-scope";
import { MenuModel, MENU_DAYS, MENU_MEALS } from "@/server/db/models/menu";
import { getIstMenuDay } from "@/server/menus/dates";

const labels: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday", breakfast: "Breakfast", lunch: "Lunch", snacks: "Snacks", dinner: "Dinner" };

export const dynamic = "force-dynamic";

export default async function TenantMenuPage() {
  const { pgId } = await requireActiveTenant();
  const menu = await MenuModel.findOne({ pgId }).lean();
  const emptyWeek = Object.fromEntries(MENU_DAYS.map((day) => [day, Object.fromEntries(MENU_MEALS.map((meal) => [meal, { items: [], isVeg: true }]))]));
  const week = menu?.week ?? emptyWeek;
  const today = getIstMenuDay();
  return <main className="mx-auto max-w-6xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident dining</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Weekly menu</h1><p className="text-foreground/60 mt-2">Today is {labels[today]} · Menu shown in Indian Standard Time.</p><div className="mt-7 space-y-5">{MENU_DAYS.map((day) => <section key={day} className={`rounded-2xl border bg-white p-5 ${today === day ? "border-primary ring-1 ring-primary/20" : ""}`}><h2 className="font-display text-primary text-2xl">{labels[day]}{today === day && <span className="ml-2 rounded-full bg-primary/10 px-3 py-1 align-middle font-sans text-xs font-semibold">Today</span>}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{MENU_MEALS.map((meal) => { const entry = week[day][meal]; return <article key={meal} className="rounded-xl bg-muted/40 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{labels[meal]}</h3><span className="text-xs text-foreground/60">{entry.isVeg ? "🟢 Veg" : "🔴 Non-veg"}</span></div><p className="mt-2 text-sm leading-6">{entry.items.length ? entry.items.join(", ") : "No menu posted"}</p></article>; })}</div></section>)}</div></main>;
}
