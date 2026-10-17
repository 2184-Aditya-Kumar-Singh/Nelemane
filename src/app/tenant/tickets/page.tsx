import { TicketWorkspace } from "./ticket-workspace";

export default function TenantTicketsPage() {
  return <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8"><p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">Resident support</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Maintenance tickets</h1><p className="text-foreground/60 mt-2">Report a repair and follow its progress with your PG owner.</p><TicketWorkspace /></main>;
}
