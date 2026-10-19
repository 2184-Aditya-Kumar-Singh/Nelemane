"use client";

import { useEffect, useState } from "react";

export function TicketCountBadge({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/owner/tickets/summary", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { attentionTickets?: unknown };
        if (active && typeof data.attentionTickets === "number" && Number.isInteger(data.attentionTickets) && data.attentionTickets >= 0) {
          setCount(data.attentionTickets);
        }
      } catch {
        // Keep showing the last known count if a temporary refresh fails.
      }
    };

    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  if (count < 1) return null;

  return <span aria-label={`${count} new or reopened maintenance tickets`} className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">{count}</span>;
}
