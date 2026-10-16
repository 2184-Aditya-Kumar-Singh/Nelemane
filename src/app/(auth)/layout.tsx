import Link from "next/link";
import type { ReactNode } from "react";
import { House } from "lucide-react";

import { APP_NAME } from "@/config/app";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="bg-background relative grid min-h-screen place-items-center overflow-hidden px-5 py-12 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 size-[34rem] rounded-full bg-amber-200/35 blur-3xl dark:bg-amber-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -left-32 size-[32rem] rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10"
      />
      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/"
          aria-label={`${APP_NAME} home`}
          className="mb-8 flex items-center justify-center gap-3"
        >
          <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-2xl shadow-lg shadow-indigo-950/10">
            <House aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </span>
          <span className="font-display text-primary text-2xl font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
