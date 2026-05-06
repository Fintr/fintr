"use client";
import React from "react";
import Navbar from "@/components/landing-page/nav-bar";
import Footer from "@/components/landing-page/footer";
import WhatsNext from "@/components/landing-page/whats-next";


const WhatsNextPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="mt-20">
        {" "}
        {/* Add margin to account for fixed navbar */}
        <WhatsNext />
      </div>
      <Footer />
    </div>
  );
};

export default WhatsNextPage;
