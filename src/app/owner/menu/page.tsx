import { MenuEditor } from "./menu-editor";

export default function OwnerMenuPage() {
  return <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident experience</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Weekly menu</h1><p className="text-foreground/60 mt-2">Set the meals your residents will see each day.</p><MenuEditor /></main>;
}
