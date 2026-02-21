import dynamic from "next/dynamic";
import Navbar from "@/components/landing-page/nav-bar";
import MobileAppSection from "@/components/landing-page/mobileapp-section";
import Footer from "@/components/landing-page/footer";
import LoadingSpinner from "@/components/ui/loading-spinner";
import CapacitorRedirectToAuth from "@/components/capacitor-redirect-to-auth";

const HeroSection = dynamic(
  () => import("@/components/landing-page/hero-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const MoneyProblemsSection = dynamic(
  () => import("@/components/landing-page/money-problems-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const FinanceAssistantSection = dynamic(
  () => import("@/components/landing-page/finance-assistant-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const CoreFeatures = dynamic(
  () => import("@/components/landing-page/core-features"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

export default async function LandingPage() {
  return (
    <CapacitorRedirectToAuth>
      <div className="w-full min-h-screen overflow-x-hidden">
        <Navbar />
        <main className="pt-20">
          <HeroSection />
          <MoneyProblemsSection />
          <FinanceAssistantSection />
          <MobileAppSection />
          <Footer />
        </main>
      </div>
    </CapacitorRedirectToAuth>
  );
}
