import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { APP_NAME, APP_TAGLINE } from "@/config/app";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} | Bengaluru PGs`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  openGraph: {
    title: `${APP_NAME} | Bengaluru PGs`,
    description: APP_TAGLINE,
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffbf5" },
    { media: "(prefers-color-scheme: dark)", color: "#111322" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem("nelemane-theme");if(t==="dark"||t==="light"){document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.classList.toggle("light",t==="light")}}catch{}` }} />
      </head>
      <body>{children}<ThemeToggle /></body>
    </html>
  );
}
