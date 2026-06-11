import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnnouncerProvider } from "@/contexts/AnnouncerContext";
import { HouseholdProvider } from "@/contexts/HouseholdContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { DeveloperUnlockProvider } from "@/contexts/DeveloperUnlockContext";
import { AuthGuard } from "@/components/AuthGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UniversalAddProvider } from "@/contexts/UniversalAddContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { DebugLogInit } from "@/components/DebugLogInit";
import { Analytics } from "@vercel/analytics/next";

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
  title: "Garden Tracker",
  description: "Track your seeds, plantings, and garden journal",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Garden Tracker",
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
        <DebugLogInit />
        <ServiceWorkerRegistration />
        <OfflineIndicator />
        <AuthProvider>
          <AnnouncerProvider>
            <HouseholdProvider>
              <SyncProvider>
                <DeveloperUnlockProvider>
                  <UniversalAddProvider>
                    <OnboardingProvider>
                      <ErrorBoundary>
                        <AuthGuard>{children}</AuthGuard>
                      </ErrorBoundary>
                    </OnboardingProvider>
                  </UniversalAddProvider>
                </DeveloperUnlockProvider>
              </SyncProvider>
            </HouseholdProvider>
          </AnnouncerProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
