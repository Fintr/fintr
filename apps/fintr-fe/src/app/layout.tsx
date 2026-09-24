import type { Metadata, Viewport } from "next";
import { League_Spartan } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import { BootstrapScripts } from "@/components/bootstrap-scripts";
import {
  shouldEnableRackMiniProfiler,
} from "@/lib/rack-mini-profiler-inline-bootstrap";
import {
  FINTR_APPLE_WEB_APP,
  FINTR_PWA_NAME,
  FINTR_PWA_THEME_COLOR,
} from "@/lib/pwa-manifest";

const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: FINTR_PWA_NAME,
  title: "Fintr - Save More. Spend Smarter. Afford The Life You Want.",
  description: "Manage your finances with ease using Fintr's comprehensive dashboard and analytics.",
  appleWebApp: FINTR_APPLE_WEB_APP,
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  minimumScale: 1.0,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: FINTR_PWA_THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const serviceWorkerUrl =
    process.env.NODE_ENV === "development" ? "/sw-dev.js" : "/sw.js";
  const rackMiniProfilerApiBase =
    shouldEnableRackMiniProfiler() && process.env.NEXT_PUBLIC_BE_URL
      ? process.env.NEXT_PUBLIC_BE_URL
      : undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${leagueSpartan.variable} antialiased ${leagueSpartan.className}`}
      >
        <BootstrapScripts
          serviceWorkerUrl={serviceWorkerUrl}
          rackMiniProfilerApiBase={rackMiniProfilerApiBase}
        />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
