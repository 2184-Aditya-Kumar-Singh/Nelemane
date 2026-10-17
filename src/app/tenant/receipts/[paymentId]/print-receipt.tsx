"use client";

export function PrintReceipt() {
  return <button type="button" onClick={() => window.print()} className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold print:hidden">Print receipt</button>;
}
