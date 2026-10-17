import type { Metadata } from "next";
import Link from "next/link";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact Nelemane", description: "Contact the Nelemane team about Bengaluru PG listings or account support." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const { intent } = await searchParams;
  return <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><Link href="/" className="text-primary text-sm font-semibold underline">← Nelemane home</Link><p className="text-accent mt-8 text-xs font-bold tracking-[0.16em] uppercase">We’re here to help</p><h1 className="font-display text-primary mt-2 text-4xl font-medium">Contact Nelemane</h1><p className="text-foreground/65 mt-3 leading-7">Ask about a PG listing, get help with your account, or send us a general question. We’ll route your message to the team.</p><ContactForm initialTopic={intent ?? ""} /></main>;
}
