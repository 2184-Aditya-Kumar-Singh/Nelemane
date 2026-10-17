"use client";

import { useEffect, useState } from "react";

export type OwnerPhotoValue = {
  assetId?: string;
  publicId?: string;
  url?: string;
  previewUrl?: string;
  caption?: string;
};

export type OwnerUploadPurpose = "OWNER_PG_PROFILE" | "PG_GALLERY" | "ROOM_TYPE_PHOTO" | "OWNER_PAYMENT_QR";

export function PhotoUpload({
  label,
  purpose,
  value,
  onChange,
}: {
  label: string;
  purpose: OwnerUploadPurpose;
  value: OwnerPhotoValue | null;
  onChange: (value: OwnerPhotoValue | null) => void;
}) {
  const [loadedPreview, setLoadedPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previewUrl = value?.previewUrl || value?.url || loadedPreview;

  useEffect(() => {
    if (!value?.assetId) return;
    let active = true;
    void fetch(`/api/owner/uploads/${value.assetId}`).then(async (response) => {
      const result = await response.json() as { asset?: { previewUrl: string } };
      if (response.ok && active && result.asset) setLoadedPreview(result.asset.previewUrl);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [value?.assetId]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("purpose", purpose);
      form.set("file", file);
      const response = await fetch("/api/owner/uploads", { method: "POST", body: form });
      const result = await response.json() as { asset?: { id: string; previewUrl: string }; error?: { message?: string } };
      if (!response.ok || !result.asset) throw new Error(result.error?.message ?? "Image upload failed");
      onChange({ assetId: result.asset.id, previewUrl: result.asset.previewUrl, caption: value?.caption ?? "" });
      setLoadedPreview(result.asset.previewUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-background p-3">
      <label className="text-xs font-semibold">{label}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); }} className="mt-2 block w-full text-xs file:mr-2 file:min-h-9 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-xs file:font-semibold file:text-white" /></label>
      <div className="mt-3 flex items-center gap-3">
        {previewUrl ? <div role="img" aria-label={`${label} preview`} className="size-16 shrink-0 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${previewUrl}")` }} /> : <div aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted text-[10px] text-foreground/45">No photo</div>}
        <div className="min-w-0 flex-1"><p className="text-foreground/55 text-xs">{busy ? "Uploading…" : value ? "Photo ready" : "JPEG, PNG or WebP · up to 5 MB"}</p>{error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}</div>
        {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="text-primary text-xs font-semibold underline">Open</a>}
        {value && <button type="button" onClick={() => { setLoadedPreview(""); onChange(null); }} className="text-xs font-semibold text-red-700 underline">Remove</button>}
      </div>
    </div>
  );
}

export function PhotoGallery({
  photos,
  onChange,
  purpose,
  max,
}: {
  photos: OwnerPhotoValue[];
  onChange: (photos: OwnerPhotoValue[]) => void;
  purpose: OwnerUploadPurpose;
  max: number;
}) {
  function replace(index: number, photo: OwnerPhotoValue | null) {
    if (photo) onChange(photos.map((item, position) => position === index ? photo : item));
    else onChange(photos.filter((_, position) => position !== index));
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [photo] = next.splice(from, 1);
    next.splice(to, 0, photo);
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      {photos.map((photo, index) => <div key={photo.assetId ?? photo.publicId ?? `photo-${index}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorder(Number(event.dataTransfer.getData("text/plain")), index); }} className="rounded-2xl border border-dashed p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-semibold">Photo {index + 1} · drag to reorder</span><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move photo ${index + 1} up`} className="size-8 rounded border text-xs disabled:opacity-40">↑</button><button type="button" disabled={index === photos.length - 1} onClick={() => move(index, 1)} aria-label={`Move photo ${index + 1} down`} className="size-8 rounded border text-xs disabled:opacity-40">↓</button></div></div>
        <PhotoUpload label={`Gallery photo ${index + 1}`} purpose={purpose} value={photo} onChange={(value) => replace(index, value)} />
        <label className="mt-2 block text-xs font-semibold">Caption<input value={photo.caption ?? ""} maxLength={240} onChange={(event) => onChange(photos.map((item, position) => position === index ? { ...item, caption: event.target.value } : item))} className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal" /></label>
      </div>)}
      {photos.length < max && <PhotoUpload label={`Add photo (${photos.length}/${max})`} purpose={purpose} value={null} onChange={(photo) => { if (photo) onChange([...photos, photo]); }} />}
      <p className="text-foreground/50 text-xs">Up to {max} images, 5 MB each. Drag to reorder; arrow buttons also work with a keyboard.</p>
    </div>
  );
}
