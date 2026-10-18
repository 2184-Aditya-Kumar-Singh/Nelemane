"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="mx-auto grid min-h-[70svh] max-w-xl content-center px-5 py-16 text-center"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">A temporary pause</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">This page did not load.</h1><p className="text-foreground/65 mt-3 text-sm leading-6">Your information is still protected. Try again, or return to the Nelemane home page.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => retry()} className="bg-primary text-primary-foreground min-h-11 rounded-xl px-5 text-sm font-semibold">Try again</button><Link href="/" className="inline-flex min-h-11 items-center rounded-xl border px-5 text-sm font-semibold">Go home</Link></div></main>;
}
