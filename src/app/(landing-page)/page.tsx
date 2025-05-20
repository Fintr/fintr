import Navbar from "@/components/landing-page/nav-bar";
import HeroSection from "@/components/landing-page/hero-section";
import DashboardPreview from "@/components/landing-page/dashboard-preview";
import CoreFeatures from "@/components/landing-page/core-features";
import MobileAppSection from "@/components/landing-page/mobileapp-section";
import Footer from "@/components/landing-page/footer";

export default async function LandingPage() {
  return (
    <div className="w-full min-h-screen overflow-x-hidden">
      <Navbar />
      <main className="pt-20">
        <HeroSection />
        <DashboardPreview />
        <div id="core-features">
          <CoreFeatures />
        </div>

        <MobileAppSection />
        <Footer />
      </main>
    </div>
  );
}
