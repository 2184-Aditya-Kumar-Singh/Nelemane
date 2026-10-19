"use client";

import { useEffect, useState } from "react";

import { MENU_DAYS, MENU_MEALS, normalizeMenuWeek, type MenuDay, type MenuFoodType, type MenuItemRecord, type MenuMeal, type MenuWeekRecord } from "@/lib/menu-types";

type Week = MenuWeekRecord;
const days: ReadonlyArray<readonly [MenuDay, string]> = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
const meals: ReadonlyArray<readonly [MenuMeal, string]> = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["snacks", "Snacks"], ["dinner", "Dinner"]];
const foodTypeChoices: ReadonlyArray<readonly [Exclude<MenuFoodType, "UNSPECIFIED">, string]> = [["VEG", "Veg"], ["NON_VEG", "Non-veg"]];
const blank = (): Week => Object.fromEntries(MENU_DAYS.map((day) => [day, Object.fromEntries(MENU_MEALS.map((meal) => [meal, { items: [] }]))])) as unknown as Week;
const newDish = (): MenuItemRecord => ({ name: "", foodType: "UNSPECIFIED", description: "" });

function MealEditor({
  day,
  meal,
  value,
  onAdd,
  onUpdate,
  onRemove,
}: {
  day: MenuDay;
  meal: MenuMeal;
  value: Week[MenuDay][MenuMeal];
  onAdd: (day: MenuDay, meal: MenuMeal) => void;
  onUpdate: (day: MenuDay, meal: MenuMeal, index: number, update: Partial<MenuItemRecord>) => void;
  onRemove: (day: MenuDay, meal: MenuMeal, index: number) => void;
}) {
  const mealLabel = meals.find(([key]) => key === meal)?.[1] ?? meal;

  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <h3 className="text-sm font-semibold">{mealLabel}</h3>
      <div className="mt-3 space-y-3">
        {value.items.map((item, index) => (
          <fieldset key={`${day}-${meal}-${index}`} className="rounded-xl border border-border bg-background p-3">
            <legend className="sr-only">{mealLabel} dish {index + 1}</legend>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="min-w-0 flex-1 text-xs font-medium">
                Dish name
                <input value={item.name ?? ""} onChange={(event) => onUpdate(day, meal, index, { name: event.target.value })} placeholder="e.g. Rice, dal, paneer, chicken" maxLength={80} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal" />
              </label>
              <fieldset className="shrink-0">
                <legend className="text-xs font-medium">Choose food type</legend>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {foodTypeChoices.map(([foodType, label]) => (
                    <label key={foodType} className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${item.foodType === foodType ? foodType === "VEG" ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100" : "border-rose-600 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-100" : "border-border text-foreground/70 hover:bg-muted"}`}>
                      <input type="radio" name={`${day}-${meal}-${index}-food-type`} value={foodType} checked={item.foodType === foodType} onChange={() => onUpdate(day, meal, index, { foodType })} className="accent-current" />
                      {label}
                    </label>
                  ))}
                </div>
                {item.foodType === "UNSPECIFIED" && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Choose Veg or Non-veg</p>}
              </fieldset>
              <button type="button" onClick={() => onRemove(day, meal, index)} aria-label={`Remove ${item.name || `dish ${index + 1}`} from ${mealLabel}`} className="min-h-10 shrink-0 rounded-lg border border-border px-3 text-sm text-foreground/70 hover:bg-muted">Remove</button>
            </div>
            <label className="mt-3 block text-xs font-medium">
              Explain this dish to residents (optional)
              <input value={item.description ?? ""} onChange={(event) => onUpdate(day, meal, index, { description: event.target.value })} placeholder="For example: Paneer is a mild Indian cottage-cheese curry" maxLength={240} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal" />
            </label>
          </fieldset>
        ))}
        {!value.items.length && <p className="text-foreground/55 text-xs">No dishes added yet.</p>}
      </div>
      <button type="button" onClick={() => onAdd(day, meal)} disabled={value.items.length >= 12} className="mt-3 min-h-10 w-full rounded-lg border border-dashed border-primary/50 px-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">+ Add another dish {value.items.length < 12 ? `(${value.items.length}/12)` : "(limit reached)"}</button>
    </div>
  );
}

export function MenuEditor() {
  const [week, setWeek] = useState<Week>(blank());
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/owner/menu", { cache: "no-store" }).then(async (res) => {
      const data = await res.json() as { week?: Week };
      if (res.ok && data.week) setWeek(normalizeMenuWeek(data.week));
      else if (!res.ok) setMessage("Menu could not be loaded");
    }).catch(() => setMessage("Menu could not be loaded")).finally(() => setBusy(false));
  }, []);

  function updateDish(day: MenuDay, meal: MenuMeal, index: number, update: Partial<MenuItemRecord>) {
    setWeek((current) => ({
      ...current,
      [day]: {
        ...current[day],
        [meal]: { items: current[day][meal].items.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item) },
      },
    }));
  }

  function addDish(day: MenuDay, meal: MenuMeal) {
    setWeek((current) => ({
      ...current,
      [day]: { ...current[day], [meal]: { items: [...current[day][meal].items, newDish()] } },
    }));
  }

  function removeDish(day: MenuDay, meal: MenuMeal, index: number) {
    setWeek((current) => ({
      ...current,
      [day]: { ...current[day], [meal]: { items: current[day][meal].items.filter((_, itemIndex) => itemIndex !== index) } },
    }));
  }

  function copyMonday() {
    setWeek((current) => ({
      ...current,
      ...Object.fromEntries(days.slice(1).map(([day]) => [day, structuredClone(current.mon)])),
    }));
  }

  async function save() {
    const hasUnclassifiedDish = days.some(([day]) => meals.some(([meal]) => week[day][meal].items.some((item) => item.name.trim() && item.foodType === "UNSPECIFIED")));
    if (hasUnclassifiedDish) {
      setMessage("Choose Veg or Non-veg for every dish before saving.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const normalized = Object.fromEntries(days.map(([day]) => [day, Object.fromEntries(meals.map(([meal]) => [meal, {
        items: week[day][meal].items.map((item) => ({ ...item, name: item.name.trim(), description: item.description.trim() })).filter((item) => item.name),
      }]))]));
      const response = await fetch("/api/owner/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: normalized }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Menu could not be saved");
      setMessage("Weekly menu saved.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Menu could not be saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-foreground/60 text-sm">Add each dish in its own box. Choose Veg or Non-veg; add a short explanation if residents may not know the dish.</p>
        <button type="button" onClick={copyMonday} disabled={busy} className="min-h-10 rounded-xl border px-4 text-sm font-semibold">Copy Monday to all days</button>
      </div>
      {busy ? <p className="rounded-2xl border bg-white p-6 text-sm">Loading menu…</p> : (
        <div className="space-y-5">
          {days.map(([day, label]) => (
            <article key={day} className="rounded-2xl border bg-white p-5">
              <h2 className="font-display text-primary text-xl">{label}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {meals.map(([meal]) => <MealEditor key={meal} day={day} meal={meal} value={week[day][meal]} onAdd={addDish} onUpdate={updateDish} onRemove={removeDish} />)}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => void save()} disabled={saving || busy} className="bg-primary text-primary-foreground min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save weekly menu"}</button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </div>
    </section>
  );
}
