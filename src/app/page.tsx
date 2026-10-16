import Link from "next/link";
import { ArrowUpRight, House, Leaf, MapPin, ShieldCheck } from "lucide-react";

import { APP_NAME, APP_TAGLINE } from "@/config/app";

const values = [
  {
    icon: ShieldCheck,
    title: "A clearer way to choose",
    description: "Compare the essentials before you visit.",
  },
  {
    icon: Leaf,
    title: "Room for real life",
    description: "Find a place that feels right for your routine.",
  },
  {
    icon: MapPin,
    title: "Made for Bengaluru",
    description: "Explore neighbourhoods across Namma Bengaluru.",
  },
];

export default function HomePage() {
  return (
    <main className="bg-background relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-28 size-[30rem] rounded-full bg-amber-200/35 blur-3xl dark:bg-amber-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 -left-36 size-[32rem] rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label={`${APP_NAME} home`}
          className="group inline-flex items-center gap-3"
        >
          <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-2xl shadow-lg shadow-indigo-950/10 transition-transform group-hover:-rotate-3">
            <House aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </span>
          <span className="leading-tight">
            <span className="font-display block text-xl font-semibold tracking-tight">
              {APP_NAME}
            </span>
            <span className="text-foreground/55 mt-0.5 block text-xs font-medium">
              ನೆಲೆಮನೆ
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-foreground/75 hover:bg-muted hover:text-foreground inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/pgs"
            className="bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-md shadow-indigo-950/10 transition-transform hover:-translate-y-0.5"
          >
            Explore PGs <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100svh-6rem)] w-full max-w-7xl items-center gap-14 px-5 pt-10 pb-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:pt-6 lg:pb-24">
        <div className="max-w-2xl">
          <div className="border-border/80 text-primary mb-7 inline-flex items-center gap-2 rounded-full border bg-white/70 px-3.5 py-2 text-xs font-semibold tracking-[0.16em] uppercase shadow-sm dark:bg-white/5">
            <span className="bg-success size-2 rounded-full" />
            Bengaluru, made more homely
          </div>

          <h1 className="font-display text-primary text-5xl leading-[1.03] font-medium tracking-[-0.045em] sm:text-6xl lg:text-[4.6rem]">
            Find your home in{" "}
            <span className="relative whitespace-nowrap">
              Namma Bengaluru
              <span
                aria-hidden="true"
                className="bg-accent/35 absolute -bottom-2 left-0 -z-10 h-3 w-full rounded-full"
              />
            </span>
          </h1>
          <p className="text-foreground/70 mt-7 max-w-xl text-lg leading-8 sm:text-xl">
            {APP_TAGLINE} Discover a place that fits your days, your budget, and
            your next chapter.
          </p>

          <form
            action="/pgs"
            method="get"
            className="border-border/80 mt-9 flex flex-col gap-3 rounded-[1.6rem] border bg-white/80 p-3 shadow-xl shadow-indigo-950/[0.06] backdrop-blur sm:flex-row sm:items-center dark:bg-white/[0.06]"
          >
            <label className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl px-3">
              <MapPin
                aria-hidden="true"
                className="text-accent size-5 shrink-0"
              />
              <span className="sr-only">Search by area</span>
              <input
                name="locality"
                type="search"
                placeholder="Which area feels like yours?"
                className="text-foreground placeholder:text-foreground/45 w-full bg-transparent text-sm outline-none"
              />
            </label>
            <button
              type="submit"
              className="bg-accent text-primary focus-visible:outline-primary min-h-14 rounded-2xl px-7 text-sm font-bold shadow-sm transition-transform hover:-translate-y-0.5"
            >
              Find my place
            </button>
          </form>

          <p className="text-foreground/50 mt-4 text-sm">
            A good place to land makes everything else feel possible.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:justify-self-end">
          <div className="absolute top-16 -left-4 z-10 hidden rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-lg shadow-indigo-950/10 backdrop-blur sm:block dark:border-white/10 dark:bg-slate-900/80">
            <p className="text-foreground/55 text-xs font-medium">
              A little more peace of mind
            </p>
            <p className="text-primary mt-1 text-sm font-semibold">
              Clear details. Confident choices.
            </p>
          </div>
          <div className="bg-primary text-primary-foreground absolute right-5 -bottom-5 z-10 rounded-2xl px-5 py-4 shadow-xl shadow-indigo-950/20 sm:right-0">
            <p className="font-display text-lg">ನೆಲೆಮನೆ</p>
            <p className="mt-1 text-xs text-white/70">
              Your place to feel at home
            </p>
          </div>

          <div className="relative aspect-[0.92] overflow-hidden rounded-[2.5rem] bg-[#d5e5d3] shadow-2xl shadow-indigo-950/15 sm:aspect-[1.02]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_10%,rgba(255,255,255,0.9),transparent_42%),linear-gradient(145deg,#dce9da_0%,#b7cdb8_48%,#93ac9a_100%)]" />
            <div className="absolute top-12 -right-12 size-64 rounded-full border-[1.5rem] border-white/25" />
            <div className="absolute bottom-6 -left-16 size-72 rounded-full border-[2rem] border-emerald-950/[0.06]" />

            <div className="absolute bottom-0 left-1/2 h-[82%] w-[72%] -translate-x-1/2 rounded-t-[9rem] bg-[#f4e7d2] shadow-2xl shadow-emerald-950/10">
              <div className="absolute inset-x-5 top-7 h-24 rounded-t-[5rem] border-[0.85rem] border-[#fffaf0] bg-[#bbd2c3] shadow-inner" />
              <div className="absolute inset-x-8 top-[8.4rem] h-[2px] bg-[#dfceb4]" />
              <div className="absolute inset-y-0 top-[8.4rem] left-1/2 w-[2px] -translate-x-1/2 bg-[#dfceb4]" />
              <div className="bg-primary absolute bottom-0 left-1/2 h-[43%] w-[34%] -translate-x-1/2 rounded-t-[4rem] shadow-[inset_0_8px_24px_rgba(255,255,255,0.12)]">
                <span className="bg-accent absolute top-1/2 right-3 size-2 rounded-full" />
              </div>
              <div className="absolute bottom-0 -left-12 h-[38%] w-14 rounded-t-full bg-emerald-900/30" />
              <div className="absolute -right-12 bottom-0 h-[46%] w-16 rounded-t-full bg-emerald-950/25" />
            </div>

            <div className="text-primary absolute top-11 left-9 grid size-12 place-items-center rounded-2xl bg-white/75 shadow-lg backdrop-blur">
              <Leaf aria-hidden="true" className="size-6" />
            </div>
            <div className="bg-accent text-primary absolute top-32 right-8 grid size-10 place-items-center rounded-full shadow-lg">
              <span className="bg-primary size-2 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-4 px-5 pb-12 sm:grid-cols-3 sm:px-8 lg:px-12">
        {values.map(({ icon: Icon, title, description }) => (
          <article
            key={title}
            className="border-border/70 flex gap-4 rounded-2xl border bg-white/55 p-5 dark:bg-white/[0.04]"
          >
            <span className="bg-accent/15 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold tracking-tight">{title}</h2>
              <p className="text-foreground/60 mt-1 text-sm leading-6">
                {description}
              </p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
