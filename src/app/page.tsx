import Link from "next/link";
import { ArrowUpRight, House, Leaf, MapPin, ShieldCheck } from "lucide-react";

import { APP_NAME, APP_TAGLINE } from "@/config/app";
import { PublicPgCard } from "@/app/_components/public-pg-card";
import { minimumRents, publicPgCard, publicPgsByIds } from "@/server/public-pgs";

export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  let featuredCards: ReturnType<typeof publicPgCard>[] = [];
  let listingsAvailable = true;
  try {
    const featured = await publicPgsByIds(undefined, 3);
    const rents = await minimumRents(featured.map((pg) => pg._id));
    featuredCards = featured.map((pg) => publicPgCard(pg, rents.get(pg._id.toString()) ?? null));
  } catch { listingsAvailable = false; }
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
          <Link href="/contact?intent=list-pg" className="text-foreground/65 hover:bg-muted hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold sm:inline-flex">List your PG</Link>
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

      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Places to begin</p><h2 className="font-display text-primary mt-2 text-3xl font-medium sm:text-4xl">Featured homes in Bengaluru</h2></div><Link href="/pgs" className="text-primary text-sm font-semibold underline underline-offset-4">Explore all PGs</Link></div>
        {featuredCards.length ? <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{featuredCards.map((pg) => <PublicPgCard key={pg.id} pg={pg} />)}</div> : <div className="mt-7 rounded-3xl border border-dashed p-8 text-center"><p className="font-display text-primary text-xl">{listingsAvailable ? "New homes are on the way." : "Listings are temporarily unavailable."}</p><p className="text-foreground/60 mt-2 text-sm">{listingsAvailable ? "Check back soon or browse Bengaluru areas to start your search." : "Please try again shortly."}</p><Link href="/pgs" className="text-primary mt-4 inline-block text-sm font-semibold underline">Browse PG listings</Link></div>}
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

      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-14 sm:px-8 lg:px-12"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">A simple start</p><h2 className="font-display text-primary mt-2 text-3xl font-medium">How it works</h2><div className="mt-5 grid gap-4 sm:grid-cols-3">{[{ n: "01", title: "Choose your area", text: "Search neighbourhoods and compare rent, facilities and room sharing." }, { n: "02", title: "Explore a PG", text: "Review the room types, rules, photos and resident ratings." }, { n: "03", title: "Talk to the owner", text: "Call or message the PG directly to confirm availability and arrange a visit." }].map((step) => <article key={step.n} className="rounded-2xl border bg-white/55 p-5 dark:bg-white/[0.04]"><span className="text-accent text-xs font-bold tracking-widest">{step.n}</span><h3 className="font-display text-primary mt-2 text-xl">{step.title}</h3><p className="text-foreground/60 mt-2 text-sm leading-6">{step.text}</p></article>)}</div></section>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-5 px-5 pb-16 sm:px-8 lg:grid-cols-2 lg:px-12">
        <article className="rounded-3xl bg-primary p-7 text-white sm:p-9"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">For residents</p><h2 className="font-display mt-3 text-3xl font-medium">Find a place that fits your next chapter.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/75">Compare neighbourhoods, facilities, room types and verified resident ratings before you visit.</p><Link href="/pgs" className="bg-accent text-primary mt-6 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold">Explore available PGs</Link></article>
        <article className="rounded-3xl border bg-white/75 p-7 sm:p-9 dark:bg-white/[0.04]"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">For PG owners</p><h2 className="font-display text-primary mt-3 text-3xl font-medium">Make day-to-day management feel lighter.</h2><p className="text-foreground/65 mt-3 max-w-lg text-sm leading-6">Keep rooms, residents, rent, menus and maintenance in one clear workspace.</p><Link href="/contact?intent=list-pg" className="bg-primary text-primary-foreground mt-6 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold">List your PG</Link></article>
      </section>

      <footer className="border-border relative z-10 border-t bg-white/55 px-5 py-7 dark:bg-white/[0.02]"><div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:px-3"><Link href="/" className="font-display text-primary text-lg font-semibold">Nelemane <span className="ml-1 text-sm">ನೆಲೆಮನೆ</span><span className="text-foreground/50 mt-1 block font-sans text-xs font-normal">Your home away from home, in Bengaluru.</span></Link><nav aria-label="Footer" className="flex flex-wrap gap-4 text-sm"><Link href="/pgs" className="hover:underline">Find a PG</Link><Link href="/contact" className="hover:underline">Contact</Link><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></nav></div></footer>
    </main>
  );
}
