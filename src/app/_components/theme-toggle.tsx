"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_CHANGE_EVENT = "nelemane-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    try { window.localStorage.setItem("nelemane-theme", next ? "dark" : "light"); } catch { /* Theme stays applied for this page view. */ }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
  return <button type="button" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Switch to light mode" : "Switch to dark mode"} className="fixed right-4 bottom-4 z-40 grid size-11 place-items-center rounded-full border bg-background text-primary shadow-lg shadow-indigo-950/15 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><span className="sr-only">{dark ? "Light mode" : "Dark mode"}</span>{dark ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />}</button>;
}
