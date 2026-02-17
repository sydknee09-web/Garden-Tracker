import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { DeveloperUnlockProvider } from "@/contexts/DeveloperUnlockContext";
import { AuthGuard } from "@/components/AuthGuard";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 2,
  userScalable: true,
  themeColor: "#059669",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Seed Vault — Garden Tracker",
  description: "Universal Garden Management PWA — Seed Vault",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192.png",
  },
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
      <body className="min-h-screen bg-paper font-sans antialiased">
        <ServiceWorkerRegistration />
        <OfflineIndicator />
        <AuthProvider>
          <SyncProvider>
            <DeveloperUnlockProvider>
              <AuthGuard>{children}</AuthGuard>
            </DeveloperUnlockProvider>
          </SyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
