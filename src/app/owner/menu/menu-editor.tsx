"use client";

import { useEffect, useState } from "react";

type Meal = { items: string[]; isVeg: boolean };
type Week = Record<string, Record<string, Meal>>;
const days = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]] as const;
const meals = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["snacks", "Snacks"], ["dinner", "Dinner"]] as const;
const blank = (): Week => Object.fromEntries(days.map(([day]) => [day, Object.fromEntries(meals.map(([meal]) => [meal, { items: [], isVeg: true }]))]));

export function MenuEditor() {
  const [week, setWeek] = useState<Week>(blank());
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/owner/menu").then(async (res) => { const data = await res.json() as { week?: Week }; if (res.ok && data.week) setWeek(data.week); }).catch(() => setMessage("Menu could not be loaded")).finally(() => setBusy(false)); }, []);

  function setMeal(day: string, meal: string, update: Partial<Meal>) {
    setWeek((current) => ({ ...current, [day]: { ...current[day], [meal]: { ...current[day][meal], ...update } } }));
  }
  function copyMonday() {
    setWeek((current) => ({ ...current, ...Object.fromEntries(days.slice(1).map(([day]) => [day, structuredClone(current.mon)])) }));
  }
  async function save() {
    setSaving(true); setMessage("");
    try {
      const normalized = Object.fromEntries(days.map(([day]) => [day, Object.fromEntries(meals.map(([meal]) => [meal, { ...week[day][meal], items: week[day][meal].items.map((item) => item.trim()).filter(Boolean) }]))]));
      const response = await fetch("/api/owner/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: normalized }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Menu could not be saved");
      setMessage("Weekly menu saved.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Menu could not be saved"); }
    finally { setSaving(false); }
  }

  return <section className="mt-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-foreground/60 text-sm">Add up to 12 dishes to each meal. Tenants can view the menu for today and the full week.</p><button type="button" onClick={copyMonday} disabled={busy} className="min-h-10 rounded-xl border px-4 text-sm font-semibold">Copy Monday to all days</button></div>
    {busy ? <p className="rounded-2xl border bg-white p-6 text-sm">Loading menu…</p> : <div className="space-y-5">{days.map(([day, label]) => <article key={day} className="rounded-2xl border bg-white p-5"><h2 className="font-display text-primary text-xl">{label}</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{meals.map(([meal, mealLabel]) => <div key={meal} className="rounded-xl bg-muted/40 p-3"><label className="text-sm font-semibold">{mealLabel}<textarea value={week[day][meal].items.join(", ")} onChange={(event) => setMeal(day, meal, { items: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12) })} placeholder="Rice, dal, salad…" rows={3} maxLength={1000} className="mt-2 w-full rounded-lg border bg-white p-2 text-sm font-normal" /></label><label className="mt-3 inline-flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={week[day][meal].isVeg} onChange={(event) => setMeal(day, meal, { isVeg: event.target.checked })} /> Vegetarian</label></div>)}</div></article>)}</div>}
    <div className="mt-5 flex flex-wrap items-center gap-4"><button type="button" onClick={() => void save()} disabled={saving || busy} className="bg-primary text-primary-foreground min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save weekly menu"}</button>{message && <p role="status" className="text-sm">{message}</p>}</div>
  </section>;
}
