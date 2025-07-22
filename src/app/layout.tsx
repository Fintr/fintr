import type { Metadata } from "next";
import { Geist, Geist_Mono, League_Spartan } from "next/font/google";
import "./globals.css";
import Providers from "@/lib/providers";
import { PerformanceMonitor } from "@/components/performance-monitor";

const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fintr - Personal Finance Management",
  description: "Manage your finances with ease using Fintr's comprehensive dashboard and analytics.",
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
        <PerformanceMonitor>
          <Providers>{children}</Providers>
        </PerformanceMonitor>
      </body>
    </html>
  );
}
