import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, League_Spartan } from "next/font/google";
import "./globals.css";
import Providers from "@/lib/providers";
import { PerformanceMonitor } from "@/components/performance-monitor";
import DeepLinkHandler from "@/components/deep-link-handler";
import CapacitorLoader from "@/components/capacitor-loader";

const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fintr - Save More. Spend Smarter. Afford The Life You Want.",
  description: "Manage your finances with ease using Fintr's comprehensive dashboard and analytics.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  minimumScale: 1.0,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${leagueSpartan.variable} antialiased ${leagueSpartan.className}`}
      >
        <CapacitorLoader />
        <PerformanceMonitor>
          <Providers>
            <DeepLinkHandler />
            {children}
          </Providers>
        </PerformanceMonitor>
      </body>
    </html>
  );
}
