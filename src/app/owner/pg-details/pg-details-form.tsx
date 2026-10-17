"use client";

import { useEffect, useState } from "react";

import { PG_FACILITIES } from "@/lib/owner-schemas";
import { PhotoGallery, PhotoUpload, type OwnerPhotoValue } from "@/app/owner/_components/photo-upload";

type PgFormState = {
  description: string;
  gender: "BOYS" | "GIRLS" | "COED";
  facilities: string[];
  customFacilities: string[];
  houseRules: string;
  profilePhoto: OwnerPhotoValue | null;
  photos: OwnerPhotoValue[];
  rentWindow: { startDay: number; endDay: number };
  reminder: { enabled: boolean; everyNDays: number; email: boolean; sms: boolean };
  isListed: boolean;
  completeness: { percent: number; missing: string[] };
  subscriptionStatus: string;
};

const emptyForm: PgFormState = {
  description: "", gender: "COED", facilities: [], customFacilities: [], houseRules: "",
  profilePhoto: null, photos: [], rentWindow: { startDay: 1, endDay: 5 },
  reminder: { enabled: true, everyNDays: 2, email: true, sms: false }, isListed: false,
  completeness: { percent: 0, missing: [] }, subscriptionStatus: "ACTIVE",
};

type ApiError = { error?: { message?: string } };

function asPhoto(value: Record<string, unknown> | null | undefined): OwnerPhotoValue | null {
  if (!value) return null;
  return {
    publicId: typeof value.publicId === "string" ? value.publicId : undefined,
    url: typeof value.url === "string" ? value.url : undefined,
    previewUrl: typeof value.previewUrl === "string" ? value.previewUrl : undefined,
    caption: typeof value.caption === "string" ? value.caption : "",
  };
}

export function PgDetailsForm() {
  const [form, setForm] = useState<PgFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [customFacility, setCustomFacility] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/owner/pg", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { pg?: Record<string, unknown> } & ApiError;
      if (!response.ok || !result.pg) throw new Error(result.error?.message ?? "PG details could not be loaded");
      const pg = result.pg;
      if (!active) return;
      setForm({
        ...emptyForm,
        description: String(pg.description ?? ""),
        gender: pg.gender === "BOYS" || pg.gender === "GIRLS" ? pg.gender : "COED",
        facilities: Array.isArray(pg.facilities) ? pg.facilities.filter((item): item is string => typeof item === "string") : [],
        customFacilities: Array.isArray(pg.customFacilities) ? pg.customFacilities.filter((item): item is string => typeof item === "string") : [],
        houseRules: String(pg.houseRules ?? ""),
        profilePhoto: asPhoto(pg.profilePhoto as Record<string, unknown> | null),
        photos: Array.isArray(pg.photos) ? pg.photos.map((item) => asPhoto(item as Record<string, unknown>)).filter((item): item is OwnerPhotoValue => Boolean(item)) : [],
        rentWindow: pg.rentWindow as PgFormState["rentWindow"] ?? emptyForm.rentWindow,
        reminder: pg.reminder as PgFormState["reminder"] ?? emptyForm.reminder,
        isListed: Boolean(pg.isListed),
        completeness: pg.completeness as PgFormState["completeness"] ?? emptyForm.completeness,
        subscriptionStatus: String(pg.subscriptionStatus ?? "ACTIVE"),
      });
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "PG details could not be loaded");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function update<K extends keyof PgFormState>(key: K, value: PgFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/owner/pg", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, completeness: undefined, subscriptionStatus: undefined }),
      });
      const result = await response.json() as { saved?: boolean } & ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "PG details could not be saved");
      const refreshed = await fetch("/api/owner/pg", { cache: "no-store" });
      const data = await refreshed.json() as { pg?: { completeness?: PgFormState["completeness"] } };
      if (data.pg?.completeness) setForm((current) => ({ ...current, completeness: data.pg?.completeness ?? current.completeness }));
      setMessage("PG profile saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PG details could not be saved");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded-2xl border bg-white p-6 text-sm text-foreground/60" role="status">Loading PG details…</div>;

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-white p-5 sm:p-7" aria-label="Profile completeness">
        <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Profile completeness</p><p className="mt-1 text-xs text-foreground/55">{form.completeness.missing.length ? `Still needed: ${form.completeness.missing.join(", ")}` : "Your listing has the key details it needs."}</p></div><strong className="text-primary text-2xl">{form.completeness.percent}%</strong></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${form.completeness.percent}%` }} /></div>
      </section>

      <form onSubmit={(event) => { void save(event); }} className="grid gap-6">
        <section className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-7">
          <div><h2 className="font-display text-primary text-2xl">About your PG</h2><p className="mt-1 text-sm text-foreground/55">A clear description helps residents understand the space.</p></div>
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <label className="text-sm font-semibold">Description<textarea value={form.description} maxLength={2000} rows={6} onChange={(event) => update("description", event.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm font-normal" placeholder="Describe your PG, nearby transit, and what makes it comfortable." /></label>
            <div><span className="text-sm font-semibold">Profile photo</span><div className="mt-2"><PhotoUpload label="PG profile photo" purpose="OWNER_PG_PROFILE" value={form.profilePhoto} onChange={(photo) => update("profilePhoto", photo)} /></div></div>
          </div>
          <label className="max-w-xs text-sm font-semibold">Residents accepted<select value={form.gender} onChange={(event) => update("gender", event.target.value as PgFormState["gender"])} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"><option value="BOYS">Men</option><option value="GIRLS">Women</option><option value="COED">All genders</option></select></label>
        </section>

        <section className="rounded-2xl border bg-white p-5 sm:p-7">
          <h2 className="font-display text-primary text-2xl">Facilities</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{PG_FACILITIES.map((facility) => <label key={facility} className="flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm"><input type="checkbox" checked={form.facilities.includes(facility)} onChange={(event) => update("facilities", event.target.checked ? [...form.facilities, facility] : form.facilities.filter((item) => item !== facility))} className="size-4 accent-primary" />{facility}</label>)}</div>
          <div className="mt-5"><label htmlFor="custom-facility" className="text-sm font-semibold">Add a facility</label><div className="mt-2 flex gap-2"><input id="custom-facility" value={customFacility} maxLength={60} onChange={(event) => setCustomFacility(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm" placeholder="For example, rooftop garden" /><button type="button" onClick={() => { const item = customFacility.trim(); if (item && !form.customFacilities.includes(item) && form.customFacilities.length < 20) update("customFacilities", [...form.customFacilities, item]); setCustomFacility(""); }} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Add</button></div><div className="mt-3 flex flex-wrap gap-2">{form.customFacilities.map((item) => <span key={item} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs">{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => update("customFacilities", form.customFacilities.filter((facility) => facility !== item))} className="font-bold">×</button></span>)}</div></div>
        </section>

        <section className="rounded-2xl border bg-white p-5 sm:p-7">
          <h2 className="font-display text-primary text-2xl">Gallery</h2><p className="mt-1 text-sm text-foreground/55">Reorder by dragging a photo or use the arrow controls.</p>
          <div className="mt-4"><PhotoGallery photos={form.photos} onChange={(photos) => update("photos", photos)} purpose="PG_GALLERY" max={20} /></div>
        </section>

        <section className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-7">
          <div><h2 className="font-display text-primary text-2xl">House rules and rent reminders</h2><p className="mt-1 text-sm text-foreground/55">Rent dates use the day of the month, from 1 to 28.</p></div>
          <label className="text-sm font-semibold">House rules<textarea value={form.houseRules} maxLength={4000} rows={5} onChange={(event) => update("houseRules", event.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm font-normal" placeholder="Quiet hours, visitor policy, and other expectations." /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Rent window starts on<input type="number" min={1} max={28} value={form.rentWindow.startDay} onChange={(event) => update("rentWindow", { ...form.rentWindow, startDay: Number(event.target.value) })} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Rent window ends on<input type="number" min={1} max={28} value={form.rentWindow.endDay} onChange={(event) => update("rentWindow", { ...form.rentWindow, endDay: Number(event.target.value) })} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm"><input type="checkbox" checked={form.reminder.enabled} onChange={(event) => update("reminder", { ...form.reminder, enabled: event.target.checked })} className="size-4 accent-primary" />Enable rent reminders</label><label className="text-sm font-semibold">Repeat every (days)<input type="number" min={1} max={30} disabled={!form.reminder.enabled} value={form.reminder.everyNDays} onChange={(event) => update("reminder", { ...form.reminder, everyNDays: Number(event.target.value) })} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal disabled:opacity-50" /></label></div>
          <div className="flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.reminder.email} onChange={(event) => update("reminder", { ...form.reminder, email: event.target.checked })} className="size-4 accent-primary" />Email reminders</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.reminder.sms} onChange={(event) => update("reminder", { ...form.reminder, sms: event.target.checked })} className="size-4 accent-primary" />SMS reminders</label></div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div><h2 className="font-display text-primary text-xl">Public listing</h2><p className="mt-1 max-w-xl text-sm text-foreground/55">Allow this PG to appear in discovery. An active subscription is required to publish.</p>{form.subscriptionStatus !== "ACTIVE" && <p className="mt-2 text-xs font-semibold text-amber-800">Subscription status: {form.subscriptionStatus}</p>}</div>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border px-4 text-sm font-semibold"><input type="checkbox" checked={form.isListed} onChange={(event) => update("isListed", event.target.checked)} className="size-4 accent-primary" />Show my PG publicly</label>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button disabled={saving} className="bg-primary text-primary-foreground min-h-12 rounded-xl px-6 text-sm font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save PG profile"}</button>{message && <p role="status" className="text-sm font-semibold text-green-800">{message}</p>}{error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}</div>
      </form>

      <PaymentDetailsForm />
    </div>
  );
}

type PaymentFormState = {
  accountType: "BUSINESS" | "PERSONAL";
  upiId: string;
  qrImage: OwnerPhotoValue | null;
  bank: { accountHolderName: string; bankName: string; accountNumber: string; ifsc: string; branch: string } | null;
  instructions: string;
};

function PaymentDetailsForm() {
  const [form, setForm] = useState<PaymentFormState>({ accountType: "BUSINESS", upiId: "", qrImage: null, bank: null, instructions: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/owner/pg/payment-details", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { paymentDetails?: Record<string, unknown> } & ApiError;
      if (!response.ok || !result.paymentDetails) throw new Error(result.error?.message ?? "Payment details could not be loaded");
      const details = result.paymentDetails;
      const bank = details.bank as PaymentFormState["bank"];
      if (active) setForm({
        accountType: details.accountType === "PERSONAL" ? "PERSONAL" : "BUSINESS",
        upiId: String(details.upiId ?? ""),
        qrImage: asPhoto(details.qrImage as Record<string, unknown> | null),
        bank: bank ? { accountHolderName: bank.accountHolderName, bankName: bank.bankName, accountNumber: bank.accountNumber, ifsc: bank.ifsc, branch: bank.branch ?? "" } : null,
        instructions: String(details.instructions ?? ""),
      });
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Payment details could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const bank = form.bank ? { ...form.bank } : null;
    try {
      const response = await fetch("/api/owner/pg/payment-details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, bank }),
      });
      const result = await response.json() as { notificationStatus?: string } & ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Payment details could not be saved");
      if (result.notificationStatus === "SENT") setMessage("Payment details saved. The platform administrator was notified of this change.");
      else if (result.notificationStatus === "SKIPPED") setMessage("Payment details saved. Email delivery is not configured, so contact the platform administrator about this change.");
      else if (result.notificationStatus === "FAILED") setMessage("Payment details saved, but the admin notification failed. Contact the platform administrator.");
      else setMessage("Payment details saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment details could not be saved");
    } finally {
      setSaving(false);
    }
  }

  function updateBank(key: keyof NonNullable<PaymentFormState["bank"]>, value: string) {
    setForm((current) => ({ ...current, bank: { ...(current.bank ?? { accountHolderName: "", bankName: "", accountNumber: "", ifsc: "", branch: "" }), [key]: value } }));
  }

  return (
    <form onSubmit={(event) => { void save(event); }} className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-7">
      <div><h2 className="font-display text-primary text-2xl">Payment details</h2><p className="mt-1 text-sm text-foreground/55">Sensitive bank account information is encrypted. Updates are audited and reported to the platform administrator.</p></div>
      {loading ? <p role="status" className="text-sm text-foreground/60">Loading payment details…</p> : <>
        <label className="max-w-sm text-sm font-semibold">Account type<select value={form.accountType} onChange={(event) => setForm((current) => ({ ...current, accountType: event.target.value as PaymentFormState["accountType"] }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"><option value="BUSINESS">Business</option><option value="PERSONAL">Personal (QR required)</option></select></label>
        <label className="max-w-sm text-sm font-semibold">UPI ID<input value={form.upiId} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, upiId: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" placeholder="name@bank" /></label>
        <div><span className="text-sm font-semibold">Payment QR</span><div className="mt-2 max-w-xl"><PhotoUpload label="Private payment QR" purpose="OWNER_PAYMENT_QR" value={form.qrImage} onChange={(qrImage) => setForm((current) => ({ ...current, qrImage }))} /></div><p className="mt-2 text-xs text-foreground/55">This image is stored privately and preview links expire quickly.</p></div>
        <div className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold">Bank transfer details</h3><p className="mt-1 text-xs text-foreground/55">Add a bank account, or remove the bank details and use a QR instead.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.bank)} onChange={(event) => setForm((current) => ({ ...current, bank: event.target.checked ? current.bank ?? { accountHolderName: "", bankName: "", accountNumber: "", ifsc: "", branch: "" } : null }))} className="size-4 accent-primary" />Use bank transfer</label></div>
          {form.bank && <div className="mt-4 grid gap-4 sm:grid-cols-2">{([ ["accountHolderName", "Account holder"], ["bankName", "Bank name"], ["accountNumber", "Account number"], ["ifsc", "IFSC"], ["branch", "Branch (optional)"] ] as const).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input required={key !== "branch"} type={key === "accountNumber" ? "password" : "text"} autoComplete={key === "accountNumber" ? "off" : undefined} value={form.bank?.[key] ?? ""} onChange={(event) => updateBank(key, event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>)}</div>}
        </div>
        <label className="text-sm font-semibold">Payment instructions<textarea value={form.instructions} maxLength={1000} rows={3} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm font-normal" placeholder="Optional instructions for residents." /></label>
      </>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button disabled={saving || loading} className="bg-primary text-primary-foreground min-h-12 rounded-xl px-6 text-sm font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save payment details"}</button>{message && <p role="status" className="text-sm font-semibold text-green-800">{message}</p>}{error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}</div>
    </form>
  );
}
