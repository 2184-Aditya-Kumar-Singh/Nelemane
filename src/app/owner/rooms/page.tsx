import { OwnerRoomsWorkspace } from "./rooms-workspace";

export default function OwnerRoomsPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Property operations
      </p>
      <h1 className="font-display text-primary mt-2 text-4xl font-medium">
        Rooms &amp; types
      </h1>
      <p className="text-foreground/60 mt-2 max-w-2xl text-sm leading-6">
        Configure room types, amenities, monthly rates, and bed capacity, then
        manage rooms and occupancy.
      </p>
      <div className="mt-7">
        <OwnerRoomsWorkspace />
      </div>
    </main>
  );
}
