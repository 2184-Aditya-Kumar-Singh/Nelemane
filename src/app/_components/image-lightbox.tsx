"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function ImageLightbox({
  src,
  alt,
  label,
  variant = "square",
}: {
  src: string;
  alt: string;
  label: string;
  variant?: "square" | "wide";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={label}
      className={`relative block overflow-hidden rounded-xl border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${variant === "wide" ? "h-56 w-full" : "size-28"}`}
    >
      <Image src={src} alt={alt} fill unoptimized sizes={variant === "wide" ? "(max-width: 768px) 100vw, 800px" : "112px"} className="object-contain" />
    </button>
    <dialog
      ref={dialogRef}
      aria-label={alt}
      onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-black/85 p-4 backdrop:bg-black/85 sm:p-8"
    >
      <div className="grid h-full w-full place-items-center">
        <button type="button" onClick={() => setOpen(false)} aria-label="Close image preview" className="absolute right-4 top-4 z-10 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black shadow-lg">Close</button>
        <div className="relative h-[min(88vh,900px)] w-full max-w-6xl">
          <Image src={src} alt={alt} fill unoptimized sizes="100vw" className="object-contain" />
        </div>
      </div>
    </dialog>
  </>;
}
