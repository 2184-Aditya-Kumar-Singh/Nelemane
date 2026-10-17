import "server-only";

const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type IstDateParts = { year: number; month: number; day: number; key: string };

export function getIstDateParts(date = new Date()): IstDateParts {
  const parts = Object.fromEntries(istDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return { year, month, day, key: `${parts.year}-${parts.month}-${parts.day}` };
}

export function getIstMonthKey(date = new Date()): string {
  const parts = getIstDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function istMidnightUtc(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -5, -30));
}

export function dateKeyForMonthDay(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export function daysBetweenDateKeys(startKey: string, endKey: string): number {
  const [startYear, startMonth, startDay] = startKey.split("-").map(Number);
  const [endYear, endMonth, endDay] = endKey.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.floor((end - start) / 86_400_000);
}

export function paymentDateFromIst(dateKey: string): Date {
  return istMidnightUtc(dateKey);
}

export function currentIstDateKey(): string {
  return getIstDateParts().key;
}
