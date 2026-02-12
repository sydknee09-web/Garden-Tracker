import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { AuthGuard } from "@/components/AuthGuard";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#059669",
};

export const metadata: Metadata = {
  title: "Seed Vault — Garden Tracker",
  description: "Universal Garden Management PWA — Seed Vault",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Seed Vault",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-screen bg-white font-sans antialiased">
        <ServiceWorkerRegistration />
        <OfflineIndicator />
        <AuthProvider>
          <SyncProvider>
            <AuthGuard>{children}</AuthGuard>
          </SyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
