"use client";

import { useCallback, useEffect, useState } from "react";
import { PhotoGallery, type OwnerPhotoValue } from "@/app/owner/_components/photo-upload";

type RoomType = { id: string; name: string; sharing: number; ac: boolean; attachedBath: boolean; rentPaise: number; depositPaise: number; description: string; amenities: string[]; photos: OwnerPhotoValue[] };
type Room = { id: string; roomNumber: string; floor: string; block: string; capacity: number; roomType: { id: string; name: string; sharing: number; rentPaise: number } | null; occupiedCount: number; freeBeds: number; occupants: Array<{ name: string; photo?: string }> };
type TypeForm = Omit<RoomType, "id">;
type RoomForm = { roomTypeId: string; roomNumber: string; floor: string; block: string; capacity: number };
type ApiError = { error?: { message?: string } };

const blankType: TypeForm = { name: "", sharing: 2, ac: false, attachedBath: false, rentPaise: 0, depositPaise: 0, description: "", amenities: [], photos: [] };
const blankRoom: RoomForm = { roomTypeId: "", roomNumber: "", floor: "Ground", block: "", capacity: 2 };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

async function loadRoomData() {
  const [a, b] = await Promise.all([fetch("/api/owner/room-types", { cache: "no-store" }), fetch("/api/owner/rooms", { cache: "no-store" })]);
  const [ad, bd] = await Promise.all([a.json() as Promise<{ roomTypes?: RoomType[] } & ApiError>, b.json() as Promise<{ rooms?: Room[] } & ApiError>]);
  if (!a.ok || !ad.roomTypes || !bd.rooms) throw new Error(ad.error?.message ?? bd.error?.message ?? "Room data could not be loaded");
  return { roomTypes: ad.roomTypes, rooms: bd.rooms };
}

export function OwnerRoomsWorkspace() {
  const [types, setTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [typeForm, setTypeForm] = useState<TypeForm>(blankType);
  const [typeId, setTypeId] = useState("");
  const [roomForm, setRoomForm] = useState<RoomForm>(blankRoom);
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [amenity, setAmenity] = useState("");

  const refresh = useCallback(async () => {
    const data = await loadRoomData();
    setTypes(data.roomTypes); setRooms(data.rooms);
    setRoomForm((current) => current.roomTypeId ? current : { ...current, roomTypeId: data.roomTypes[0]?.id ?? "", capacity: data.roomTypes[0]?.sharing ?? 1 });
  }, []);

  useEffect(() => {
    let active = true;
    void loadRoomData().then((data) => {
      if (!active) return;
      setTypes(data.roomTypes);
      setRooms(data.rooms);
      setRoomForm((current) => current.roomTypeId ? current : { ...current, roomTypeId: data.roomTypes[0]?.id ?? "", capacity: data.roomTypes[0]?.sharing ?? 1 });
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Room data could not be loaded"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>, kind: "type" | "room") {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const editing = kind === "type" ? typeId : roomId;
    const path = kind === "type" ? "/api/owner/room-types" : "/api/owner/rooms";
    try {
      const response = await fetch(editing ? `${path}/${editing}` : path, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "type" ? typeForm : roomForm) });
      const result = await response.json() as ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Changes could not be saved");
      await refresh();
      if (kind === "type") { setTypeForm(blankType); setTypeId(""); } else { setRoomForm(blankRoom); setRoomId(""); }
      setNotice(editing ? "Changes saved." : `${kind === "type" ? "Room type" : "Room"} created.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Changes could not be saved"); }
    finally { setBusy(false); }
  }

  async function remove(path: string, id: string, label: string) {
    if (!window.confirm(`Delete ${label}?`)) return;
    setError(""); setNotice("");
    try {
      const response = await fetch(`${path}/${id}`, { method: "DELETE" });
      const result = await response.json() as ApiError;
      if (!response.ok) throw new Error(result.error?.message ?? "Could not delete this item");
      await refresh(); setNotice("Deleted.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete this item"); }
  }

  if (loading) return <div role="status" className="rounded-2xl border bg-white p-6 text-sm text-foreground/60">Loading rooms…</div>;

  return (
    <div className="grid gap-7">
      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"}`}>{error || notice}</p>}
      <div className="grid gap-7 xl:grid-cols-2">
        <form onSubmit={(event) => { void submit(event, "type"); }} className="grid content-start gap-4 rounded-2xl border bg-white p-5 sm:p-7">
          <div><h2 className="font-display text-primary text-2xl">{typeId ? "Edit room type" : "Create room type"}</h2><p className="mt-1 text-sm text-foreground/55">Configure sharing, monthly rent, deposit, and amenities.</p></div>
          <label className="text-sm font-semibold">Type name<input required minLength={2} maxLength={100} value={typeForm.name} onChange={(e) => setTypeForm((v) => ({ ...v, name: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" placeholder="Twin sharing · AC" /></label>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Sharing<select value={typeForm.sharing} onChange={(e) => setTypeForm((v) => ({ ...v, sharing: Number(e.target.value) }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-2 text-sm font-normal">{[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} sharing</option>)}</select></label><label className="text-sm font-semibold">Rent (₹)<input type="number" min={0} max={1000000} value={typeForm.rentPaise / 100} onChange={(e) => setTypeForm((v) => ({ ...v, rentPaise: Math.round(Number(e.target.value) * 100) }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Deposit (₹)<input type="number" min={0} max={10000000} value={typeForm.depositPaise / 100} onChange={(e) => setTypeForm((v) => ({ ...v, depositPaise: Math.round(Number(e.target.value) * 100) }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label></div>
          <div className="flex flex-wrap gap-3"><label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm"><input type="checkbox" checked={typeForm.ac} onChange={(e) => setTypeForm((v) => ({ ...v, ac: e.target.checked }))} />Air conditioning</label><label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm"><input type="checkbox" checked={typeForm.attachedBath} onChange={(e) => setTypeForm((v) => ({ ...v, attachedBath: e.target.checked }))} />Attached bathroom</label></div>
          <label className="text-sm font-semibold">Description<textarea maxLength={1000} rows={3} value={typeForm.description} onChange={(e) => setTypeForm((v) => ({ ...v, description: e.target.value }))} className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm font-normal" /></label>
          <div><label htmlFor="room-amenity" className="text-sm font-semibold">Amenities</label><div className="mt-2 flex gap-2"><input id="room-amenity" value={amenity} onChange={(e) => setAmenity(e.target.value)} maxLength={60} className="min-h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm" placeholder="Add an amenity" /><button type="button" onClick={() => { const item = amenity.trim(); if (item && !typeForm.amenities.includes(item) && typeForm.amenities.length < 20) setTypeForm((v) => ({ ...v, amenities: [...v.amenities, item] })); setAmenity(""); }} className="rounded-lg border px-3 text-sm font-semibold">Add</button></div><div className="mt-2 flex flex-wrap gap-2">{typeForm.amenities.map((item) => <span key={item} className="rounded-full bg-muted px-3 py-1.5 text-xs">{item} <button type="button" aria-label={`Remove ${item}`} onClick={() => setTypeForm((v) => ({ ...v, amenities: v.amenities.filter((x) => x !== item) }))}>×</button></span>)}</div></div>
          <div><h3 className="text-sm font-semibold">Photos (up to 8)</h3><PhotoGallery photos={typeForm.photos} onChange={(photos) => setTypeForm((v) => ({ ...v, photos }))} purpose="ROOM_TYPE_PHOTO" max={8} /></div>
          <div className="flex gap-2"><button disabled={busy} className="bg-primary text-primary-foreground min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : typeId ? "Save room type" : "Create room type"}</button>{typeId && <button type="button" onClick={() => { setTypeId(""); setTypeForm(blankType); }} className="rounded-xl border px-4 text-sm font-semibold">Cancel</button>}</div>
        </form>
        <form onSubmit={(event) => { void submit(event, "room"); }} className="grid content-start gap-4 rounded-2xl border bg-white p-5 sm:p-7">
          <div><h2 className="font-display text-primary text-2xl">{roomId ? "Edit room" : "Add a room"}</h2><p className="mt-1 text-sm text-foreground/55">Room numbers are unique within each block.</p></div>
          {!types.length ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Create a room type before adding rooms.</p> : <>
            <label className="text-sm font-semibold">Room type<select required value={roomForm.roomTypeId} onChange={(e) => { const type = types.find((item) => item.id === e.target.value); setRoomForm((v) => ({ ...v, roomTypeId: e.target.value, capacity: type?.sharing ?? v.capacity })); }} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal">{types.map((type) => <option key={type.id} value={type.id}>{type.name} · {type.sharing} sharing</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Room number<input required maxLength={30} value={roomForm.roomNumber} onChange={(e) => setRoomForm((v) => ({ ...v, roomNumber: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" placeholder="101" /></label><label className="text-sm font-semibold">Floor<input required maxLength={40} value={roomForm.floor} onChange={(e) => setRoomForm((v) => ({ ...v, floor: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" placeholder="First floor" /></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Block (optional)<input maxLength={60} value={roomForm.block} onChange={(e) => setRoomForm((v) => ({ ...v, block: e.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" placeholder="A" /></label><label className="text-sm font-semibold">Beds / capacity<input required type="number" min={1} max={types.find((item) => item.id === roomForm.roomTypeId)?.sharing ?? 6} value={roomForm.capacity} onChange={(e) => setRoomForm((v) => ({ ...v, capacity: Number(e.target.value) }))} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /><span className="mt-1 block text-xs font-normal text-foreground/50">Up to this type’s {types.find((item) => item.id === roomForm.roomTypeId)?.sharing ?? 6}-person sharing.</span></label></div>
            <div className="flex gap-2"><button disabled={busy} className="bg-primary text-primary-foreground min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : roomId ? "Save room" : "Add room"}</button>{roomId && <button type="button" onClick={() => { setRoomId(""); setRoomForm(blankRoom); }} className="rounded-xl border px-4 text-sm font-semibold">Cancel</button>}</div>
          </>}
        </form>
      </div>

      <section className="rounded-2xl border bg-white p-5 sm:p-7" aria-labelledby="types-heading">
        <h2 id="types-heading" className="font-display text-primary text-2xl">Room types <span className="font-sans text-sm text-foreground/50">{types.length}</span></h2>
        {types.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{types.map((type) => <article key={type.id} className="rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{type.name}</h3><p className="mt-1 text-xs text-foreground/55">{type.sharing} sharing · {type.ac ? "AC" : "Non-AC"} · {type.attachedBath ? "Attached bath" : "Shared bath"}</p></div><span className="text-xs text-foreground/55">{rooms.filter((room) => room.roomType?.id === type.id).length} rooms</span></div><p className="text-primary mt-4 text-lg font-bold">{money(type.rentPaise)} <span className="text-xs font-normal text-foreground/55">/ month</span></p><p className="mt-1 text-xs text-foreground/55">Deposit {money(type.depositPaise)}</p>{type.description && <p className="mt-3 text-sm text-foreground/65">{type.description}</p>}{type.amenities.length > 0 && <p className="mt-3 text-xs text-foreground/60">{type.amenities.join(" · ")}</p>}<div className="mt-4 flex gap-2"><button type="button" onClick={() => { setTypeId(type.id); setTypeForm({ ...type, amenities: [...type.amenities], photos: type.photos.map((photo) => ({ ...photo })) }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="min-h-10 rounded-lg border px-3 text-xs font-semibold">Edit</button><button type="button" onClick={() => { void remove("/api/owner/room-types", type.id, `room type ${type.name}`); }} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">Delete</button></div></article>)}</div> : <p className="mt-4 rounded-xl bg-muted/60 p-5 text-sm text-foreground/60">No room types yet. Add the first one above.</p>}
      </section>

      <section className="rounded-2xl border bg-white p-5 sm:p-7" aria-labelledby="occupancy-heading">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="occupancy-heading" className="font-display text-primary text-2xl">Occupancy board</h2><p className="mt-1 text-sm text-foreground/55">Resident assignments appear here as tenant records are added.</p></div><p className="rounded-xl bg-muted px-4 py-2 text-sm"><strong>{rooms.reduce((sum, room) => sum + room.freeBeds, 0)}</strong> free / <strong>{rooms.reduce((sum, room) => sum + room.capacity, 0)}</strong> beds</p></div>
        {rooms.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-foreground/50"><th className="py-3 pr-3">Room</th><th className="py-3 pr-3">Type</th><th className="py-3 pr-3">Occupancy</th><th className="py-3 pr-3">Residents</th><th className="py-3 text-right">Actions</th></tr></thead><tbody>{rooms.map((room) => <tr key={room.id} className="border-b last:border-0"><td className="py-4 pr-3 font-semibold">{room.block ? `${room.block} · ` : ""}{room.roomNumber}<span className="mt-1 block text-xs font-normal text-foreground/50">{room.floor}</span></td><td className="py-4 pr-3">{room.roomType?.name ?? "Unknown type"}<span className="mt-1 block text-xs text-foreground/50">{room.roomType ? money(room.roomType.rentPaise) : ""} / month</span></td><td className="py-4 pr-3"><strong>{room.occupiedCount} / {room.capacity}</strong><span className="mt-1 block text-xs text-foreground/55">{room.freeBeds} free</span></td><td className="py-4 pr-3">{room.occupants.length ? room.occupants.map((person) => person.name).join(", ") : <span className="text-foreground/45">No residents assigned</span>}</td><td className="py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setRoomId(room.id); setRoomForm({ roomTypeId: room.roomType?.id ?? "", roomNumber: room.roomNumber, floor: room.floor, block: room.block, capacity: room.capacity }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="min-h-9 rounded-lg border px-3 text-xs font-semibold">Edit</button><button type="button" onClick={() => { void remove("/api/owner/rooms", room.id, `room ${room.roomNumber}`); }} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">Delete</button></div></td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl bg-muted/60 p-5 text-sm text-foreground/60">Add rooms to see bed capacity and availability here.</p>}
      </section>
    </div>
  );
}
