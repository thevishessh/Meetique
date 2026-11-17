import type { Metadata, Viewport } from "next";
import { Epilogue, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: meetings and QR tokens`, template: `%s, ${APP_NAME}` },
  description: APP_TAGLINE,
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

// Ink theme faces: Epilogue 400/600/700 for everything, IBM Plex Mono only for token numbers
const epilogue = Epilogue({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-epilogue", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-plex-mono", display: "swap" });

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#141414" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${epilogue.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
