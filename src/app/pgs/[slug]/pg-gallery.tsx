"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export type PgGalleryPhoto = { url: string; caption?: string };

export function PgGallery({ name, photos }: { name: string; photos: PgGalleryPhoto[] }) {
  const [active, setActive] = useState<number | null>(null);
  const shown = photos.slice(0, 5);
  if (!shown.length) return <div className="grid aspect-[1.8] place-items-center rounded-3xl bg-[radial-gradient(ellipse_at_25%_20%,rgba(255,255,255,0.8),transparent_40%),linear-gradient(145deg,#dce9da,#93ac9a)] text-sm font-semibold text-primary">Photos coming soon</div>;
  const change = (direction: number) => setActive((index) => index === null ? null : (index + direction + shown.length) % shown.length);
  return <div className="grid gap-3 sm:grid-cols-[1.6fr_0.8fr]">
    <button type="button" onClick={() => setActive(0)} aria-label={`Open ${name} photo gallery`} className="relative aspect-[1.3] overflow-hidden rounded-3xl bg-muted text-left focus-visible:outline-2 focus-visible:outline-primary sm:aspect-auto sm:min-h-[24rem]">
      <Image src={shown[0]!.url} alt={shown[0]!.caption || `${name} exterior or common area`} fill sizes="(max-width: 640px) 100vw, 65vw" unoptimized priority className="object-cover transition-transform hover:scale-[1.02]" />
      <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-primary">View photos · {shown.length}</span>
    </button>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">{shown.slice(1, 3).map((photo, index) => <button key={`${photo.url}-${index}`} type="button" onClick={() => setActive(index + 1)} aria-label={`Open photo ${index + 2} of ${name}`} className="relative min-h-28 overflow-hidden rounded-2xl bg-muted focus-visible:outline-2 focus-visible:outline-primary"><Image src={photo.url} alt={photo.caption || `${name} photo ${index + 2}`} fill sizes="(max-width: 640px) 50vw, 30vw" unoptimized className="object-cover transition-transform hover:scale-[1.03]" /></button>)}</div>
    {active !== null && <div role="dialog" aria-modal="true" aria-label={`${name} photo gallery`} tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") setActive(null); if (event.key === "ArrowLeft") change(-1); if (event.key === "ArrowRight") change(1); }} className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4" onClick={() => setActive(null)}><button type="button" autoFocus onClick={() => setActive(null)} aria-label="Close gallery" className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><X aria-hidden="true" /></button><button type="button" onClick={(event) => { event.stopPropagation(); change(-1); }} aria-label="Previous photo" className="absolute left-3 z-10 grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-8"><ArrowLeft aria-hidden="true" /></button><div className="relative h-[75svh] w-full max-w-5xl" onClick={(event) => event.stopPropagation()}><Image src={shown[active]!.url} alt={shown[active]!.caption || `${name} photo ${active + 1}`} fill sizes="100vw" unoptimized className="object-contain" /><p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-center text-xs text-white">{shown[active]!.caption || `${active + 1} of ${shown.length}`}</p></div><button type="button" onClick={(event) => { event.stopPropagation(); change(1); }} aria-label="Next photo" className="absolute right-3 z-10 grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-8"><ArrowRight aria-hidden="true" /></button></div>}
  </div>;
}
