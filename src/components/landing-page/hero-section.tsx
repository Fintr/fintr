"use client";
import React from "react";
import { motion } from "framer-motion";
import WaitlistForm from "@/components/landing-page/waitlist-form";

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  logoSrc?: string;
}

const HeroSection = ({
  title = "Save More. Spend Smarter. Afford The Life You Want.",
  subtitle = "Your personal finance assistant. Just take a photo of your receipt, Fintr will do the rest. Ask money questions, Fintr responds with answers tailored for you.",
  logoSrc = "/fintr-logo.png",
}: HeroSectionProps) => {
  return (
    <section className="relative w-full py-16 md:py-24 lg:py-32 bg-background overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-6 tracking-tight leading-tight">
              {title
                .split(" ")
                .map((word) =>
                  word.toLowerCase() === "to" ||
                  word.toLowerCase() === "from" ||
                  word.toLowerCase() === "at"
                    ? word.toLowerCase()
                    : word.charAt(0).toUpperCase() +
                      word.slice(1).toLowerCase(),
                )
                .join(" ")}
            </h1>

            <p className="text-lg md:text-xl text-primary mb-8 leading-relaxed">
              {subtitle}
            </p>

          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
