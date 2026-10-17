import Link from "next/link";

export default function NotFoundPage() {
  return <main className="mx-auto grid min-h-[70svh] max-w-xl content-center px-5 py-16 text-center"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Not found</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">We could not find that page.</h1><p className="text-foreground/65 mt-3 text-sm leading-6">The link may have changed, or the page is no longer available.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/pgs" className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold">Explore PGs</Link><Link href="/" className="inline-flex min-h-11 items-center rounded-xl border px-5 text-sm font-semibold">Go home</Link></div></main>;
}
