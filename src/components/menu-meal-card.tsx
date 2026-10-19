import type { MenuMealRecord } from "@/lib/menu-types";

const foodTypeInfo = {
  VEG: { label: "Veg", dot: "bg-emerald-600", badge: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" },
  NON_VEG: { label: "Non-veg", dot: "bg-rose-600", badge: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100" },
  UNSPECIFIED: { label: "Ask PG owner", dot: "bg-slate-400", badge: "border-border bg-muted text-foreground/70" },
} as const;

export function MenuMealCard({ title, meal }: { title: string; meal: MenuMealRecord }) {
  return (
    <article className="rounded-xl bg-muted/40 p-4">
      <h3 className="font-semibold">{title}</h3>
      {meal.items.length ? (
        <ul className="mt-3 space-y-2">
          {meal.items.map((item, index) => {
            const foodType = foodTypeInfo[item.foodType];
            return (
              <li key={`${item.name}-${index}`} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 text-sm font-semibold">{item.name}</span>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${foodType.badge}`}>
                    <span aria-hidden="true" className={`size-2 rounded-full ${foodType.dot}`} />
                    {foodType.label}
                  </span>
                </div>
                {item.description && <p className="text-foreground/65 mt-1 text-xs leading-5">{item.description}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-foreground/65 mt-2 text-sm">No menu posted</p>
      )}
    </article>
  );
}
