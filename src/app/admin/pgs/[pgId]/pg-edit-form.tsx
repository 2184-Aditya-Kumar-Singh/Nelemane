"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PgAdminDetail {
  id: string;
  name: string;
  owner: { name: string; phone: string; email: string };
  address: { line1: string; locality: string; city: string; state: string; pincode: string; landmark?: string; mapsUrl?: string };
  gstNumber: string;
  nominee: { name: string; phone?: string; relation?: string };
  subscription: { status: "ACTIVE" | "SUSPENDED" | "CANCELLED"; planLabel: string; startsAt: string; endsAt: string; notes?: string };
  paymentDetails: {
    accountType: "BUSINESS" | "PERSONAL";
    upiId: string;
    qrImage: { publicId: string } | null;
    bank: { accountHolderName: string; bankName: string; accountNumberLastFour?: string; ifsc: string; branch: string } | null;
    instructions: string;
  };
  isListed: boolean;
  status: "ACTIVE" | "DELETED";
}

export function PgEditForm({ pg }: { pg: PgAdminDetail }) {
  const router = useRouter();
  const [owner, setOwner] = useState(pg.owner);
  const [name, setName] = useState(pg.name);
  const [address, setAddress] = useState(pg.address);
  const [gstNumber, setGstNumber] = useState(pg.gstNumber);
  const [nominee, setNominee] = useState({ name: pg.nominee.name, phone: pg.nominee.phone ?? "", relation: pg.nominee.relation ?? "" });
  const [subscription, setSubscription] = useState({ planLabel: pg.subscription.planLabel, startsAt: pg.subscription.startsAt, endsAt: pg.subscription.endsAt, notes: pg.subscription.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/pgs/${pg.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner, name, address, gstNumber, nominee, subscription }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Changes could not be saved");
      setNotice("PG details saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Changes could not be saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="border-border rounded-2xl border bg-white p-5 sm:p-6">
      <h2 className="font-display text-primary text-2xl font-medium">Edit PG</h2>
      <p className="text-foreground/55 mt-1 text-sm">Changes to the owner email also update their sign-in address.</p>
      <div className="mt-5 grid gap-4">
        <Field label="PG name" value={name} onChange={setName} required />
        <Field label="Owner name" value={owner.name} onChange={(value) => setOwner({ ...owner, name: value })} required />
        <Field label="Owner phone" value={owner.phone} onChange={(value) => setOwner({ ...owner, phone: value })} required />
        <Field label="Owner email" type="email" value={owner.email} onChange={(value) => setOwner({ ...owner, email: value })} required />
        <Field label="Address" value={address.line1} onChange={(value) => setAddress({ ...address, line1: value })} required />
        <Field label="Locality" value={address.locality} onChange={(value) => setAddress({ ...address, locality: value })} required />
        <div className="grid grid-cols-2 gap-3"><Field label="City" value={address.city} onChange={(value) => setAddress({ ...address, city: value })} required /><Field label="PIN code" value={address.pincode} onChange={(value) => setAddress({ ...address, pincode: value })} required /></div>
        <Field label="State" value={address.state} onChange={(value) => setAddress({ ...address, state: value })} required />
        <Field label="Landmark" value={address.landmark ?? ""} onChange={(value) => setAddress({ ...address, landmark: value })} />
        <Field label="Google Maps link" type="url" value={address.mapsUrl ?? ""} onChange={(value) => setAddress({ ...address, mapsUrl: value })} />
        <Field label="GSTIN" value={gstNumber} onChange={setGstNumber} />
        <Field label="Nominee name" value={nominee.name} onChange={(value) => setNominee({ ...nominee, name: value })} required />
        <Field label="Nominee phone" value={nominee.phone} onChange={(value) => setNominee({ ...nominee, phone: value })} />
        <Field label="Nominee relation" value={nominee.relation} onChange={(value) => setNominee({ ...nominee, relation: value })} />
        <div className="border-border border-t pt-4"><h3 className="text-sm font-semibold">Subscription</h3><div className="mt-3 grid gap-4"><Field label="Plan label" value={subscription.planLabel} onChange={(value) => setSubscription({ ...subscription, planLabel: value })} required /><div className="grid grid-cols-2 gap-3"><Field label="Starts" type="date" value={subscription.startsAt} onChange={(value) => setSubscription({ ...subscription, startsAt: value })} required /><Field label="Ends" type="date" value={subscription.endsAt} onChange={(value) => setSubscription({ ...subscription, endsAt: value })} required /></div><label className="text-sm font-semibold">Admin notes<textarea value={subscription.notes} onChange={(event) => setSubscription({ ...subscription, notes: event.target.value })} rows={3} maxLength={1000} className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" /></label></div></div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-4 text-sm text-green-800">{notice}</p>}
      <button disabled={busy || pg.status === "DELETED"} className="bg-primary text-primary-foreground mt-5 min-h-11 w-full rounded-xl px-5 text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
      {pg.status === "DELETED" && <p className="text-foreground/55 mt-3 text-xs">This PG is soft deleted. Its details are read-only until purged.</p>}
    </form>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-sm font-semibold">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal" /></label>;
}
