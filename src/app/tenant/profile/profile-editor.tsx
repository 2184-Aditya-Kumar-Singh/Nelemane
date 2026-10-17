"use client";

import { useEffect, useState } from "react";

type Profile = { name: string; phone: string; email: string; profilePhotoUrl: string; pgName: string };
type Review = { rating: number; comment: string } | null;

export function TenantProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [review, setReview] = useState<Review>(null);
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<{ id: string; previewUrl: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/tenant/profile").then(async (response) => { const data = await response.json() as { profile?: Profile; review?: Review }; if (response.ok && data.profile) { setProfile(data.profile); setPhone(data.profile.phone); setReview(data.review ?? null); setRating(data.review?.rating ?? 0); setComment(data.review?.comment ?? ""); } }).catch(() => setMessage("Profile could not be loaded")); }, []);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("purpose", "TENANT_PROFILE"); form.set("file", file);
      const response = await fetch("/api/tenant/uploads", { method: "POST", body: form });
      const data = await response.json() as { asset?: { id: string; previewUrl: string }; error?: { message?: string } };
      if (!response.ok || !data.asset) throw new Error(data.error?.message ?? "Photo upload failed");
      setPhoto(data.asset); setRemovePhoto(false);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Photo upload failed"); }
    finally { setBusy(false); }
  }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/tenant/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, ...(photo ? { profilePhotoAssetId: photo.id } : removePhoto ? { profilePhotoAssetId: null } : {}) }) });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Profile could not be saved");
      setMessage("Profile saved."); setPhoto(null); setRemovePhoto(false);
      const refreshed = await fetch("/api/tenant/profile").then((res) => res.json()) as { profile?: Profile };
      if (refreshed.profile) { setProfile(refreshed.profile); setPhone(refreshed.profile.phone); }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Profile could not be saved"); }
    finally { setBusy(false); }
  }
  async function saveReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!rating) { setMessage("Choose a star rating first."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/tenant/review", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, comment }) });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Review could not be saved");
      setReview({ rating, comment }); setMessage("Your PG rating is saved. You can edit it any time.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Review could not be saved"); }
    finally { setBusy(false); }
  }
  const previewUrl = photo?.previewUrl || (removePhoto ? "" : profile?.profilePhotoUrl ?? "");
  return <div className="mt-7 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border bg-white p-5 sm:p-6"><h2 className="font-display text-primary text-2xl">Contact details</h2>{profile ? <form className="mt-5 space-y-4" onSubmit={(event) => void saveProfile(event)}><div><p className="text-xs font-semibold text-foreground/55">Name</p><p className="mt-1 font-semibold">{profile.name}</p></div><div><p className="text-xs font-semibold text-foreground/55">Email</p><p className="mt-1 break-all text-sm">{profile.email}</p></div><label className="block text-sm font-semibold">Phone<input required minLength={7} maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="block text-sm font-semibold">Profile picture<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} className="mt-2 block w-full text-xs file:min-h-10 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-white" /></label><div className="flex items-center gap-3">{previewUrl ? <div role="img" aria-label="Profile photo preview" className="size-20 rounded-full bg-cover bg-center" style={{ backgroundImage: `url("${previewUrl}")` }} /> : <div className="grid size-20 place-items-center rounded-full bg-muted text-xs text-foreground/45">No photo</div>}{(profile.profilePhotoUrl || photo) && !removePhoto && <button type="button" onClick={() => { setPhoto(null); setRemovePhoto(true); }} className="text-sm font-semibold text-red-700 underline">Remove picture</button>}{removePhoto && <button type="button" onClick={() => setRemovePhoto(false)} className="text-sm underline">Undo</button>}</div><button disabled={busy} className="bg-primary text-primary-foreground min-h-11 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-60">Save profile</button></form> : <p className="mt-4 text-sm">Loading profile…</p>}</section>
    <section className="rounded-2xl border bg-white p-5 sm:p-6"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">{profile?.pgName || "Your PG"}</p><h2 className="font-display text-primary mt-2 text-2xl">Rate your PG</h2><p className="text-foreground/60 mt-2 text-sm">Your rating can be edited later.</p><form className="mt-5" onSubmit={(event) => void saveReview(event)}><div className="flex gap-2" role="radiogroup" aria-label="PG rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} aria-label={`${value} star${value > 1 ? "s" : ""}`} className={`text-3xl ${rating >= value ? "text-amber-500" : "text-foreground/25"}`}>★</button>)}</div><label className="mt-4 block text-sm font-semibold">Comment<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={5} className="mt-2 w-full rounded-xl border p-3 font-normal" placeholder="What do you like or what could improve?" /></label><button disabled={busy} className="bg-primary text-primary-foreground mt-4 min-h-11 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-60">{review ? "Update rating" : "Save rating"}</button>{review && <p className="text-foreground/50 mt-2 text-xs">Your current rating: {review.rating}/5</p>}</form></section>{message && <p role="status" className="text-sm lg:col-span-2">{message}</p>}</div>;
}
