import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";

import { formatRupees, type PublicPgCardData } from "@/server/public-pgs";

const genderLabel = { BOYS: "Men", GIRLS: "Women", COED: "All genders" } as const;

export function PublicPgCard({ pg }: { pg: PublicPgCardData }) {
  return <article className="group overflow-hidden rounded-3xl border border-border/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/10 dark:bg-white/[0.04]">
    <Link href={`/pgs/${encodeURIComponent(pg.slug)}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <div className="bg-muted relative aspect-[1.55] overflow-hidden">
        {pg.imageUrl ? <Image src={pg.imageUrl} alt={`${pg.name} in ${pg.locality}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_20%,rgba(255,255,255,0.8),transparent_40%),linear-gradient(145deg,#dce9da,#93ac9a)]" aria-label="No PG photo available" role="img" />}
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur">{genderLabel[pg.gender]}</span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3"><h2 className="font-display text-primary text-xl font-medium">{pg.name}</h2><span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold"><Star aria-hidden="true" className="size-4 fill-amber-400 text-amber-500" />{pg.ratingCount ? pg.ratingAvg.toFixed(1) : "New"}</span></div>
        <p className="text-foreground/60 mt-2 flex items-center gap-1.5 text-sm"><MapPin aria-hidden="true" className="size-4 shrink-0" />{pg.locality}, Bengaluru</p>
        <p className="text-foreground/65 mt-3 line-clamp-2 min-h-10 text-sm leading-5">{pg.description || "A comfortable place to call home in Bengaluru."}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">{pg.facilities.slice(0, 3).map((facility) => <span key={facility} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">{facility}</span>)}</div>
        <div className="border-border mt-5 flex items-end justify-between border-t pt-4"><div><p className="text-foreground/50 text-xs">Starting monthly rent</p><p className="text-primary mt-1 font-semibold">{pg.startingRentPaise === null ? "Contact for pricing" : `${formatRupees(pg.startingRentPaise)} / bed`}</p></div><span className="text-foreground/50 text-xs">{pg.ratingCount} {pg.ratingCount === 1 ? "review" : "reviews"}</span></div>
      </div>
    </Link>
  </article>;
}
