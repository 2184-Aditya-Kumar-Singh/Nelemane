"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PhotoUpload, type OwnerPhotoValue } from "@/app/owner/_components/photo-upload";

type RoomOption = { id: string; roomNumber: string; floor: string; block: string; capacity: number; freeBeds: number; roomType: { id: string; name: string; sharing: number; rentPaise: number; depositPaise: number } | null };
type TenantForm = { name: string; phone: string; email: string; roomId: string; monthlyRentPaise: number; depositPaise: number; joinedAt: string; fatherName: string; motherName: string; parentPhone: string; alternatePhone: string; profilePhoto: OwnerPhotoValue | null; aadhaarPhoto: OwnerPhotoValue | null; aadhaarConsent: boolean; sendCredentialsNow: boolean };
type ApiError = { error?: { message?: string; fields?: Array<{ path: string; message: string }> } };
const empty: TenantForm = { name: "", phone: "", email: "", roomId: "", monthlyRentPaise: 0, depositPaise: 0, joinedAt: "", fatherName: "", motherName: "", parentPhone: "", alternatePhone: "", profilePhoto: null, aadhaarPhoto: null, aadhaarConsent: false, sendCredentialsNow: true };
const moneyValue = (paise: number) => String(paise / 100);

export function AddTenantForm() {
  const [form, setForm] = useState<TenantForm>(empty);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/owner/rooms", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { rooms?: RoomOption[] } & ApiError;
      if (!response.ok || !result.rooms) throw new Error(result.error?.message ?? "Available rooms could not be loaded");
      if (active) {
        setRooms(result.rooms);
        const first = result.rooms.find((room) => room.freeBeds > 0);
        if (first) setForm((current) => ({ ...current, roomId: first.id, monthlyRentPaise: first.roomType?.rentPaise ?? 0, depositPaise: first.roomType?.depositPaise ?? 0 }));
      }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Available rooms could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedRoom = rooms.find((room) => room.id === form.roomId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/owner/tenants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, phone: form.phone, email: form.email, roomId: form.roomId,
          monthlyRentPaise: form.monthlyRentPaise, depositPaise: form.depositPaise, joinedAt: form.joinedAt,
          parents: { fatherName: form.fatherName, motherName: form.motherName, phone: form.parentPhone, alternatePhone: form.alternatePhone },
          profilePhoto: form.profilePhoto, aadhaarPhoto: form.aadhaarPhoto, aadhaarConsent: form.aadhaarConsent,
          sendCredentialsNow: form.sendCredentialsNow,
        }),
      });
      const result = await response.json() as { tenant?: { name: string }; credentialsDelivery?: string; smsDelivery?: string } & ApiError;
      if (!response.ok || !result.tenant) {
        const fieldErrors = result.error?.fields?.map((field) => `${field.path}: ${field.message}`).join(" · ");
        throw new Error(fieldErrors || result.error?.message || "Tenant could not be added");
      }
      const credentialText = result.credentialsDelivery === "SENT" ? "Login credentials emailed." : result.credentialsDelivery === "FAILED" ? "Tenant created, but the credential email failed; ask the resident to use Forgot password." : result.credentialsDelivery === "SKIPPED" ? "Tenant created; email delivery is not configured. Ask the resident to use Forgot password." : "Tenant created. Credentials were not sent; the resident can use Forgot password.";
      const smsText = result.smsDelivery === "SENT" ? " SMS credentials were sent." : result.smsDelivery === "FAILED" ? " SMS delivery failed." : result.smsDelivery === "SKIPPED" ? " SMS is not configured." : "";
      setMessage(`${result.tenant.name} was added. ${credentialText}${smsText}`);
      const responseRooms = await fetch("/api/owner/rooms", { cache: "no-store" });
      const data = await responseRooms.json() as { rooms?: RoomOption[] };
      const latestRooms = responseRooms.ok && data.rooms ? data.rooms : rooms;
      if (responseRooms.ok && data.rooms) setRooms(data.rooms);
      const nextRoom = latestRooms.find((room) => room.freeBeds > 0);
      setForm((current) => ({ ...empty, roomId: nextRoom?.id ?? "", monthlyRentPaise: nextRoom?.roomType?.rentPaise ?? 0, depositPaise: nextRoom?.roomType?.depositPaise ?? 0, joinedAt: current.joinedAt }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tenant could not be added"); }
    finally { setSaving(false); }
  }

  if (loading) return <p role="status" className="rounded-2xl border bg-white p-6 text-sm text-foreground/60">Loading available rooms…</p>;
  if (!rooms.some((room) => room.freeBeds > 0)) return <section className="rounded-2xl border bg-white p-6">
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">{message}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {!message && !error && <p className="text-sm text-foreground/65">There are no free beds right now. Add a room or vacate a tenant before onboarding another resident.</p>}
    {message && <p className="mt-4 text-sm text-foreground/65">There are no free beds left. Add a room or vacate a tenant before onboarding another resident.</p>}
    <Link href="/owner/rooms" className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Manage rooms</Link>
  </section>;

  return (
    <form onSubmit={(event) => { void submit(event); }} onInvalidCapture={() => { setMessage(""); setError("Please complete the required fields before adding this tenant."); }} className="grid gap-6">
      {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
      <section className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-7">
        <h2 className="font-display text-primary text-2xl">Resident details</h2>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Email<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Phone<input required type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" placeholder="9876543210" /></label><label className="text-sm font-semibold">Join date<input required type="date" value={form.joinedAt} onChange={(e) => setForm((v) => ({ ...v, joinedAt: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label></div>
      </section>

      <section className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-7">
        <div><h2 className="font-display text-primary text-2xl">Room and rent</h2><p className="mt-1 text-sm text-foreground/55">Room details are filled in from the room you select. Rent and deposit start with the room type defaults.</p></div>
        <label className="text-sm font-semibold">Room<select required value={form.roomId} onChange={(e) => { const room = rooms.find((item) => item.id === e.target.value); setForm((v) => ({ ...v, roomId: e.target.value, monthlyRentPaise: room?.roomType?.rentPaise ?? v.monthlyRentPaise, depositPaise: room?.roomType?.depositPaise ?? v.depositPaise })); }} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal">{rooms.filter((room) => room.freeBeds > 0).map((room) => <option key={room.id} value={room.id}>{room.block ? `${room.block} · ` : ""}{room.roomNumber} · {room.floor} · {room.roomType?.name ?? "Room type"} · {room.freeBeds} free</option>)}</select></label>
        {selectedRoom && <div className="rounded-xl bg-muted/60 p-4 text-sm"><p className="font-semibold">{selectedRoom.roomType?.name ?? "Room"} · {selectedRoom.block ? `${selectedRoom.block} · ` : ""}{selectedRoom.roomNumber}</p><p className="mt-1 text-xs text-foreground/55">{selectedRoom.floor} · {selectedRoom.capacity} beds · {selectedRoom.freeBeds} currently free</p></div>}
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">Monthly rent (₹)<input required type="number" min={0} step="1" value={moneyValue(form.monthlyRentPaise)} onChange={(e) => setForm((v) => ({ ...v, monthlyRentPaise: Math.round(Number(e.target.value) * 100) }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Deposit (₹)<input required type="number" min={0} step="1" value={moneyValue(form.depositPaise)} onChange={(e) => setForm((v) => ({ ...v, depositPaise: Math.round(Number(e.target.value) * 100) }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label></div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:p-7">
        <div><h2 className="font-display text-primary text-2xl">Parents or emergency contacts</h2><p className="mt-1 text-sm text-foreground/55">At least one parent or guardian contact is required.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Father / guardian name<input required minLength={2} maxLength={120} value={form.fatherName} onChange={(e) => setForm((v) => ({ ...v, fatherName: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Mother name (optional)<input maxLength={120} value={form.motherName} onChange={(e) => setForm((v) => ({ ...v, motherName: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Parent / guardian phone<input required type="tel" value={form.parentPhone} onChange={(e) => setForm((v) => ({ ...v, parentPhone: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Alternate phone (optional)<input type="tel" value={form.alternatePhone} onChange={(e) => setForm((v) => ({ ...v, alternatePhone: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label></div>
      </section>

      <section className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-7">
        <div><h2 className="font-display text-primary text-2xl">Private documents</h2><p className="mt-1 text-sm text-foreground/55">Images are private. Aadhaar requires the resident’s consent and is only viewable by the PG owner through a short-lived signed link.</p></div>
        <div className="grid gap-4 md:grid-cols-2"><div><PhotoUpload label="Tenant profile photo (optional)" purpose="TENANT_PROFILE" value={form.profilePhoto} onChange={(photo) => setForm((v) => ({ ...v, profilePhoto: photo }))} /></div><div><PhotoUpload label="Aadhaar image (optional)" purpose="TENANT_AADHAAR" value={form.aadhaarPhoto} onChange={(photo) => setForm((v) => ({ ...v, aadhaarPhoto: photo }))} /><label className="mt-3 flex items-start gap-3 rounded-xl border p-3 text-xs leading-5"><input type="checkbox" checked={form.aadhaarConsent} onChange={(e) => setForm((v) => ({ ...v, aadhaarConsent: e.target.checked }))} className="mt-0.5 size-4 shrink-0 accent-primary" /><span>I confirm the resident gave consent for this Aadhaar image to be stored for PG administration.</span></label></div></div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><h2 className="font-display text-primary text-xl">Account credentials</h2><p className="mt-1 text-sm text-foreground/55">A secure temporary password is generated. The resident must change it after signing in.</p></div><label className="flex min-h-11 items-center gap-3 rounded-xl border px-4 text-sm font-semibold"><input type="checkbox" checked={form.sendCredentialsNow} onChange={(e) => setForm((v) => ({ ...v, sendCredentialsNow: e.target.checked }))} className="size-4 accent-primary" />Email credentials now</label></section>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving} className="bg-primary text-primary-foreground min-h-12 rounded-xl px-6 text-sm font-semibold disabled:opacity-50">{saving ? "Adding tenant…" : "Add tenant"}</button><Link href="/owner/tenants" className="inline-flex min-h-12 items-center rounded-xl border px-5 text-sm font-semibold">Cancel</Link></div>
    </form>
  );
}
