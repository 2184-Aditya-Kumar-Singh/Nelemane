import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { APP_NAME, APP_TAGLINE } from "@/config/app";
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
  themeColor: "#fffbf5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
