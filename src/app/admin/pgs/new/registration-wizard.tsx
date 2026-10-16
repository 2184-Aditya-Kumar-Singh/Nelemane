"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { pgRegistrationSchema } from "@/lib/pg-schemas";

interface RegistrationForm {
  owner: { name: string; phone: string; email: string; profileAssetId: string };
  pg: {
    name: string;
    address: { line1: string; locality: string; city: string; state: string; pincode: string; landmark: string; mapsUrl: string };
    gstNumber: string;
    nominee: { name: string; phone: string; relation: string };
    profileAssetId: string;
  };
  payment: {
    accountType: "BUSINESS" | "PERSONAL";
    upiId: string;
    qrAssetId: string;
    bankEnabled: boolean;
    bank: { accountHolderName: string; bankName: string; accountNumber: string; ifsc: string; branch: string };
    instructions: string;
  };
  subscription: { planLabel: string; startsAt: string; endsAt: string; notes: string };
}

const STORAGE_KEY = "nelemane.admin.pg-registration.v1";
const initialForm: RegistrationForm = {
  owner: { name: "", phone: "", email: "", profileAssetId: "" },
  pg: {
    name: "",
    address: { line1: "", locality: "", city: "Bengaluru", state: "Karnataka", pincode: "", landmark: "", mapsUrl: "" },
    gstNumber: "",
    nominee: { name: "", phone: "", relation: "" },
    profileAssetId: "",
  },
  payment: {
    accountType: "BUSINESS",
    upiId: "",
    qrAssetId: "",
    bankEnabled: false,
    bank: { accountHolderName: "", bankName: "", accountNumber: "", ifsc: "", branch: "" },
    instructions: "",
  },
  subscription: { planLabel: "", startsAt: "", endsAt: "", notes: "" },
};

const steps = ["Owner", "PG details", "Rent collection", "Subscription"];

function restoreDraft(): RegistrationForm | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<RegistrationForm>;
    return {
      ...initialForm,
      ...saved,
      owner: { ...initialForm.owner, ...saved.owner },
      pg: { ...initialForm.pg, ...saved.pg, address: { ...initialForm.pg.address, ...saved.pg?.address }, nominee: { ...initialForm.pg.nominee, ...saved.pg?.nominee } },
      payment: {
        ...initialForm.payment,
        ...saved.payment,
        bankEnabled: saved.payment?.bankEnabled ?? Boolean(saved.payment?.bank?.bankName),
        bank: { ...initialForm.payment.bank, ...saved.payment?.bank, accountNumber: "" },
      },
      subscription: { ...initialForm.subscription, ...saved.subscription },
    };
  } catch {
    return null;
  }
}

export function RegistrationWizard() {
  const router = useRouter();
  const [form, setForm] = useState<RegistrationForm>(initialForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function commit(next: RegistrationForm) {
    setForm(next);
    const safeDraft = {
      ...next,
      payment: {
        accountType: next.payment.accountType,
        upiId: next.payment.upiId,
        qrAssetId: next.payment.qrAssetId,
        bankEnabled: next.payment.bankEnabled,
        bank: {
          accountHolderName: next.payment.bank.accountHolderName,
          bankName: next.payment.bank.bankName,
          ifsc: next.payment.bank.ifsc,
          branch: next.payment.bank.branch,
        },
        instructions: next.payment.instructions,
      },
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safeDraft)); } catch { /* Draft saving is best effort when browser storage is blocked. */ }
  }

  function updateOwner(field: keyof RegistrationForm["owner"], value: string) {
    commit({ ...form, owner: { ...form.owner, [field]: value } });
  }

  function updatePg(field: "name" | "gstNumber" | "profileAssetId", value: string) {
    commit({ ...form, pg: { ...form.pg, [field]: value } });
  }

  function updateAddress(field: keyof RegistrationForm["pg"]["address"], value: string) {
    commit({ ...form, pg: { ...form.pg, address: { ...form.pg.address, [field]: value } } });
  }

  function updateNominee(field: keyof RegistrationForm["pg"]["nominee"], value: string) {
    commit({ ...form, pg: { ...form.pg, nominee: { ...form.pg.nominee, [field]: value } } });
  }

  function updatePayment(field: "accountType" | "upiId" | "qrAssetId" | "instructions", value: string) {
    commit({ ...form, payment: { ...form.payment, [field]: value } });
  }

  function updateBank(field: keyof RegistrationForm["payment"]["bank"], value: string) {
    commit({ ...form, payment: { ...form.payment, bank: { ...form.payment.bank, [field]: value } } });
  }

  function updateSubscription(field: keyof RegistrationForm["subscription"], value: string) {
    commit({ ...form, subscription: { ...form.subscription, [field]: value } });
  }

  function validateStep() {
    const candidate = {
      ...form,
      owner: { ...form.owner, profileAssetId: form.owner.profileAssetId || undefined },
      pg: { ...form.pg, profileAssetId: form.pg.profileAssetId || undefined },
      payment: {
        ...form.payment,
        bank: form.payment.bankEnabled ? form.payment.bank : undefined,
        qrAssetId: form.payment.qrAssetId || undefined,
      },
    };
    const field = [pgRegistrationSchema.shape.owner, pgRegistrationSchema.shape.pg, pgRegistrationSchema.shape.payment, pgRegistrationSchema.shape.subscription][currentStep];
    const data = [candidate.owner, candidate.pg, candidate.payment, candidate.subscription][currentStep];
    const result = field.safeParse(data);
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join(" · "));
      return false;
    }
    setError("");
    return true;
  }

  async function submit() {
    const candidate = {
      owner: { ...form.owner, profileAssetId: form.owner.profileAssetId || undefined },
      pg: { ...form.pg, profileAssetId: form.pg.profileAssetId || undefined },
      payment: {
        accountType: form.payment.accountType,
        upiId: form.payment.upiId,
        qrAssetId: form.payment.qrAssetId || undefined,
        bank: form.payment.bankEnabled ? form.payment.bank : undefined,
        instructions: form.payment.instructions,
      },
      subscription: form.subscription,
    };
    const parsed = pgRegistrationSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" · "));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/pgs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json() as {
        pg?: { id: string };
        credentialsDelivery?: "SENT" | "SKIPPED" | "FAILED";
        error?: { message?: string; fields?: Array<{ path: string; message: string }> };
      };
      if (!response.ok || !body.pg) throw new Error(body.error?.fields?.map((field) => `${field.path}: ${field.message}`).join(" · ") ?? body.error?.message ?? "PG could not be registered");
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* Ignore blocked browser storage. */ }
      if (body.credentialsDelivery === "SENT") setMessage("Owner credentials were emailed.");
      else if (body.credentialsDelivery === "SKIPPED") setMessage("Development email was skipped; check the local server terminal for the owner credential message.");
      else setMessage("The PG was created, but the owner email failed. Ask the owner to use password recovery before signing in.");
      router.push(`/admin/pgs/${body.pg.id}?created=1&credentials=${body.credentialsDelivery ?? "FAILED"}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PG could not be registered");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (validateStep()) setCurrentStep((step) => Math.min(steps.length - 1, step + 1));
  }

  function restoreSavedDraft() {
    const draft = restoreDraft();
    if (!draft) {
      setError("There is no saved draft in this browser.");
      return;
    }
    setForm(draft);
    setError("");
    setCurrentStep(0);
  }

  return (
    <section className="mt-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-8">
      <ol aria-label="Registration progress" className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => <li key={step} aria-current={currentStep === index ? "step" : undefined} className={`border-t-4 pt-2 text-xs font-semibold sm:text-sm ${index <= currentStep ? "border-accent text-primary" : "border-border text-foreground/40"}`}><span className="mr-1">{index + 1}.</span>{step}</li>)}
      </ol>

      {currentStep === 0 && <div className="mt-7 grid gap-4 sm:grid-cols-2"><SectionHeading title="Owner account" description="The owner signs in with this email and receives a temporary password." /><Field label="Owner name" value={form.owner.name} onChange={(value) => updateOwner("name", value)} required /><Field label="Phone" value={form.owner.phone} onChange={(value) => updateOwner("phone", value)} placeholder="+91 98765 43210" required /><Field label="Email" type="email" value={form.owner.email} onChange={(value) => updateOwner("email", value)} required /><UploadField label="Owner profile picture (required)" purpose="OWNER_PROFILE" assetId={form.owner.profileAssetId} onChange={(assetId) => updateOwner("profileAssetId", assetId)} />
        <div className="sm:col-span-2"><p className="text-foreground/55 text-xs">The generated password is temporary and the owner must change it on first sign-in.</p></div></div>}

      {currentStep === 1 && <div className="mt-7 grid gap-4 sm:grid-cols-2"><SectionHeading title="PG profile and address" description="Add the property identity and a contact nominee." /><Field label="PG name" value={form.pg.name} onChange={(value) => updatePg("name", value)} required /><Field label="Address line" value={form.pg.address.line1} onChange={(value) => updateAddress("line1", value)} required /><Field label="Locality" value={form.pg.address.locality} onChange={(value) => updateAddress("locality", value)} required /><Field label="PIN code" value={form.pg.address.pincode} onChange={(value) => updateAddress("pincode", value)} required /><Field label="City" value={form.pg.address.city} onChange={(value) => updateAddress("city", value)} required /><Field label="State" value={form.pg.address.state} onChange={(value) => updateAddress("state", value)} required /><Field label="Landmark" value={form.pg.address.landmark} onChange={(value) => updateAddress("landmark", value)} /><Field label="Google Maps link" type="url" value={form.pg.address.mapsUrl} onChange={(value) => updateAddress("mapsUrl", value)} placeholder="https://maps.google.com/..." /><Field label="GSTIN (optional)" value={form.pg.gstNumber} onChange={(value) => updatePg("gstNumber", value)} /><Field label="Nominee name" value={form.pg.nominee.name} onChange={(value) => updateNominee("name", value)} required /><Field label="Nominee phone" value={form.pg.nominee.phone} onChange={(value) => updateNominee("phone", value)} /><Field label="Nominee relation" value={form.pg.nominee.relation} onChange={(value) => updateNominee("relation", value)} /><UploadField label="PG profile picture (required)" purpose="PG_PROFILE" assetId={form.pg.profileAssetId} onChange={(assetId) => updatePg("profileAssetId", assetId)} /></div>}

      {currentStep === 2 && <div className="mt-7 grid gap-4 sm:grid-cols-2"><SectionHeading title="Rent collection details" description="Payment instructions are private to the PG and will be stored securely." /><label className="text-sm font-semibold sm:col-span-2">Does this PG collect rent in a business account or the owner&apos;s personal account?<select value={form.payment.accountType} onChange={(event) => updatePayment("accountType", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="BUSINESS">Business account</option><option value="PERSONAL">Owner&apos;s personal account</option></select></label><Field label="UPI ID" value={form.payment.upiId} onChange={(value) => updatePayment("upiId", value)} placeholder="name@bank" /><UploadField label={`Payment QR screenshot${form.payment.accountType === "PERSONAL" ? " (required)" : ""}`} purpose="PAYMENT_QR" assetId={form.payment.qrAssetId} onChange={(assetId) => updatePayment("qrAssetId", assetId)} /><label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={form.payment.bankEnabled} onChange={(event) => commit({ ...form, payment: { ...form.payment, bankEnabled: event.target.checked } })} className="size-4 accent-indigo-900" />Add bank transfer details</label>{form.payment.bankEnabled && <><Field label="Account holder name" value={form.payment.bank.accountHolderName} onChange={(value) => updateBank("accountHolderName", value)} required /><Field label="Bank name" value={form.payment.bank.bankName} onChange={(value) => updateBank("bankName", value)} required /><Field label="Account number" type="password" value={form.payment.bank.accountNumber} onChange={(value) => updateBank("accountNumber", value)} autoComplete="off" required /><Field label="IFSC" value={form.payment.bank.ifsc} onChange={(value) => updateBank("ifsc", value)} required /><Field label="Branch (optional)" value={form.payment.bank.branch} onChange={(value) => updateBank("branch", value)} /></>}<label className="text-sm font-semibold sm:col-span-2">Payment instructions<textarea value={form.payment.instructions} onChange={(event) => updatePayment("instructions", event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" /></label><p className="text-foreground/55 text-xs sm:col-span-2">At least a QR image or complete bank details are required. Personal accounts must include a QR. The account number is encrypted before it is saved and never stored in the browser draft.</p></div>}

      {currentStep === 3 && <div className="mt-7 grid gap-4 sm:grid-cols-2"><SectionHeading title="Subscription" description="Set the initial plan label and active dates." /><Field label="Plan label" value={form.subscription.planLabel} onChange={(value) => updateSubscription("planLabel", value)} placeholder="Standard · 12 months" required /><Field label="Start date" type="date" value={form.subscription.startsAt} onChange={(value) => updateSubscription("startsAt", value)} required /><Field label="End date" type="date" value={form.subscription.endsAt} onChange={(value) => updateSubscription("endsAt", value)} required /><label className="text-sm font-semibold sm:col-span-2">Admin notes<textarea value={form.subscription.notes} onChange={(event) => updateSubscription("notes", event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" /></label><div className="rounded-2xl bg-muted/60 p-4 text-sm sm:col-span-2"><p className="font-semibold">Registration summary</p><p className="text-foreground/60 mt-2">{form.pg.name || "PG name"} · {form.pg.address.locality || "Locality"}, Bengaluru</p><p className="text-foreground/60">Owner: {form.owner.name || "Owner"} · {form.owner.email || "Email"}</p><p className="text-foreground/60">{form.subscription.planLabel || "Plan"} · {form.subscription.startsAt || "Start"} → {form.subscription.endsAt || "End"}</p></div></div>}

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
      <div className="mt-7 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2"><button type="button" onClick={() => setCurrentStep((step) => Math.max(0, step - 1))} disabled={currentStep === 0 || busy} className="min-h-11 rounded-xl border px-5 text-sm font-semibold disabled:opacity-40">Back</button><button type="button" onClick={restoreSavedDraft} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Restore saved draft</button></div>
        {currentStep < steps.length - 1 ? <button type="button" onClick={next} className="bg-primary text-primary-foreground min-h-11 rounded-xl px-5 text-sm font-semibold">Continue</button> : <button type="button" onClick={submit} disabled={busy} className="bg-primary text-primary-foreground min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-50">{busy ? "Creating PG…" : "Create PG and owner"}</button>}
      </div>
    </section>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="sm:col-span-2"><h2 className="font-display text-primary text-2xl font-medium">{title}</h2><p className="text-foreground/55 mt-1 text-sm">{description}</p></div>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return <label className="text-sm font-semibold">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} autoComplete={autoComplete} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal" /></label>;
}

function UploadField({ label, purpose, assetId, onChange }: { label: string; purpose: "OWNER_PROFILE" | "PG_PROFILE" | "PAYMENT_QR"; assetId: string; onChange: (assetId: string) => void }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!assetId) return;
    let active = true;
    void fetch(`/api/admin/uploads/${assetId}`).then(async (response) => {
      const result = await response.json() as { asset?: { previewUrl: string } };
      if (response.ok && active && result.asset) setPreviewUrl(result.asset.previewUrl);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [assetId]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.set("purpose", purpose);
      data.set("file", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body: data });
      const result = await response.json() as { asset?: { id: string; previewUrl: string }; error?: { message: string } };
      if (!response.ok || !result.asset) throw new Error(result.error?.message ?? "Image upload failed");
      onChange(result.asset.id);
      setPreviewUrl(result.asset.previewUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  }

  return <div className="text-sm font-semibold">{label}<div className="mt-1 flex min-h-20 items-center gap-3 rounded-xl border bg-background p-3">
    {previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" aria-label={`Preview ${label}`} className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-xs text-primary">Preview</a> : <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted text-xs text-foreground/50">Image</span>}
    <div className="min-w-0 flex-1"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files?.[0]); }} disabled={busy} className="block w-full text-xs file:mr-2 file:min-h-9 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-xs file:font-semibold file:text-white" /><p className="text-foreground/50 mt-1 text-xs">JPEG, PNG or WebP · up to 5 MB · {busy ? "Uploading…" : assetId ? "Uploaded" : "Optional"}</p>{assetId && <button type="button" onClick={() => { onChange(""); setPreviewUrl(""); }} className="text-primary mt-1 text-xs font-semibold underline">Remove image</button>}{error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}</div>
  </div></div>;
}
