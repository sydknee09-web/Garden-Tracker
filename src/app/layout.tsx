import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { AuthGuard } from "@/components/AuthGuard";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Seed Vault — Garden Tracker",
  description: "Universal Garden Management PWA — Fresh Antigravity",
  manifest: "/manifest.json",
  themeColor: "#059669",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Seed Vault",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
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
