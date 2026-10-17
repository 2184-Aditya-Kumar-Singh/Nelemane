import "server-only";

import type { MenuDay } from "@/server/db/models/menu";

const days: Record<string, MenuDay> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };

export function getIstMenuDay(date = new Date()): MenuDay {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(date);
  return days[name] ?? "mon";
}
