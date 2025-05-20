"use client";
import React, { useState } from "react";
import {
  ArrowRight,
  Check,
  Goal,
  Wallet,
  CreditCard,
  PieChart,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import { Button } from "../ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface CoreFeatureItem {
  title: string;
  description: string;
  bulletPoints: string[];
  icon: React.ReactNode;
  imageSrc: string;
}

interface CoreFeaturesProps {
  title?: string;
  subtitle?: string;
  features?: CoreFeatureItem[];
}

const CoreFeatures = ({
  title = "Core Features",
  subtitle = "Everything you need to take control of your finances",
  features = [
    {
      title: "Goal Setting",
      description:
        "Set financial goals and track your progress with visual dashboards.",
      bulletPoints: [
        "Create short and long-term financial goals",
        "Track progress with visual indicators",
        "Receive notifications when you reach milestones",
        "Adjust goals as your financial situation changes",
      ],
      icon: <Goal className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
    },
    {
      title: "Income & Expense Tracker",
      description: "Track all your income sources and expenses in one place.",
      bulletPoints: [
        "Automatically categorize transactions",
        "Connect multiple bank accounts and credit cards",
        "Set up recurring income and expense tracking",
        "Generate detailed financial reports",
        "Export reports for tax purposes",
        "Visualize spending patterns with interactive charts",
        "Set custom categories for personalized tracking",
      ],
      icon: <Wallet className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1554224155-1696413565d3?w=800&q=80",
    },
    {
      title: "Loan Tracker",
      description:
        "Monitor your loans and see how much you're paying in interest.",
      bulletPoints: [
        "Track multiple loans in one dashboard",
        "Calculate interest payments and principal reduction",
        "Visualize payoff timelines",
        "Simulate early payoff scenarios",
      ],
      icon: <CreditCard className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80",
    },
    {
      title: "Budget Tracker",
      description: "Create and manage budgets for different categories.",
      bulletPoints: [
        "Set monthly budgets for different spending categories",
        "Get alerts when you're approaching budget limits",
        "Adjust budgets based on historical spending",
        "Compare actual spending to budgeted amounts",
      ],
      icon: <PieChart className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?w=800&q=80",
    },
    {
      title: "Investments Tracker",
      description: "Monitor and manage your investment portfolio in real-time.",
      bulletPoints: [
        "Track stocks, bonds, ETFs, and cryptocurrencies",
        "Monitor portfolio performance and returns",
        "Analyze asset allocation and diversification",
        "Set investment goals and track progress",
        "Receive market updates and alerts",
        "Compare your investments against market benchmarks",
      ],
      icon: <BarChart3 className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
    },
    {
      title: "Insights",
      description: "Receive personalized insights about your spending habits.",
      bulletPoints: [
        "AI-powered analysis of your spending patterns",
        "Identify opportunities to save money",
        "Personalized recommendations for financial improvement",
        "Trend analysis to predict future expenses",
      ],
      icon: <MessageSquare className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    },
  ],
}: CoreFeaturesProps) => {
  const [activeFeature, setActiveFeature] = useState<number | null>(0);

  const handleFeatureClick = (index: number) => {
    setActiveFeature(index);
  };

  return (
    <section className="py-16 md:py-24 bg-[#FAF9F6]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-3xl mb-12 md:mb-16 mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#0A3D62]">
            {title
              .split(" ")
              .map((word) =>
                word.toLowerCase() === "to" ||
                word.toLowerCase() === "from" ||
                word.toLowerCase() === "at"
                  ? word.toLowerCase()
                  : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
              )
              .join(" ")}
          </h2>
          <p className="text-lg text-[#0A3D62] leading-relaxed">{subtitle}</p>
        </div>

        {/* Feature Navigation Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-12 overflow-x-auto pb-2">
          {features.map((feature, index) => (
            <button
              key={index}
              onClick={() => handleFeatureClick(index)}
              className={`px-4 py-2 rounded-full transition-all duration-300 flex items-center whitespace-nowrap ${activeFeature === index ? "bg-[#0A3D62] text-white" : "bg-white text-[#0A3D62] border border-[#0A3D62] hover:bg-[#0A3D62]/10"}`}
            >
              <span className="mr-2">{feature.icon}</span>
              {feature.title}
            </button>
          ))}
        </div>

        {/* Feature Details */}
        <AnimatePresence mode="wait">
          {activeFeature !== null && (
            <motion.div
              key={activeFeature}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto"
            >
              <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/2">
                  <div className="flex items-center mb-4">
                    <div className="mr-3 text-[#0A3D62] bg-[#f9f7f5] p-3 rounded-full">
                      {features[activeFeature].icon}
                    </div>
                    <h3 className="text-2xl font-bold text-[#0A3D62]">
                      {features[activeFeature].title}
                    </h3>
                  </div>
                  <p className="text-[#0A3D62] mb-6">
                    {features[activeFeature].description}
                  </p>
                  <ul className="space-y-3 mb-6">
                    {features[activeFeature].bulletPoints.map((point, i) => (
                      <li key={i} className="flex items-start">
                        <Check className="h-5 w-5 text-[#0A3D62] mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-[#0A3D62]">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:w-1/2">
                  <img
                    src={features[activeFeature].imageSrc}
                    alt={features[activeFeature].title}
                    className="rounded-lg w-full h-64 object-cover shadow-md"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default CoreFeatures;
