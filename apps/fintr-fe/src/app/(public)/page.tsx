import dynamic from "next/dynamic";
import Navbar from "@/components/landing-page/nav-bar";
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

const WhatWeDoSection = dynamic(
  () => import("@/components/landing-page/what-we-do-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const ProblemSection = dynamic(
  () => import("@/components/landing-page/problem-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const FeaturesSection = dynamic(
  () => import("@/components/landing-page/features-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const MarketSection = dynamic(
  () => import("@/components/landing-page/market-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const PricingSection = dynamic(
  () => import("@/components/landing-page/pricing-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const AppCarouselSection = dynamic(
  () => import("@/components/landing-page/app-carousel-section"),
  {
    loading: () => (
      <div className="w-full h-96 flex items-center justify-center bg-[#0A2540]">
        <LoadingSpinner size="large" />
      </div>
    ),
  }
);

const TeamSection = dynamic(
  () => import("@/components/landing-page/team-section"),
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
      <div className="w-full min-h-screen font-garet">
        <Navbar />
        <main className="overflow-x-clip">
          <HeroSection />
          <AppCarouselSection />
          <WhatWeDoSection />
          <ProblemSection />
          <FeaturesSection />
          <MarketSection />
          <PricingSection />
          <TeamSection />
          <Footer />
        </main>
      </div>
    </CapacitorRedirectToAuth>
  );
}
