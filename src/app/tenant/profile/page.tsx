import { TenantProfileEditor } from "./profile-editor";

export default function TenantProfilePage() {
  return <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident account</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">My profile</h1><p className="text-foreground/60 mt-2">Update your contact phone and profile picture. Name and email are managed by your PG.</p><TenantProfileEditor /></main>;
}
