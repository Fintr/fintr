import React from "react";
import HowToUse from "@/components/landing-page/how-to-use";
import Navbar from "@/components/landing-page/nav-bar";
import Footer from "@/components/landing-page/footer";

const DiscoverPage = () => {
  return (
    <div className="flex flex-col">
      <Navbar />
      <div className="mt-20">
        <HowToUse />
      </div>
      <Footer />
    </div>
  );
};

export default DiscoverPage;
