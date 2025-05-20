import React, { useState } from "react";
import {
  MessageSquare,
  BarChart3,
  Smartphone,
  Image,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "../ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface FeatureItem {
  title: string;
  description: string;
  bulletPoints: string[];
  icon: React.ReactNode;
  imageSrc: string;
}

interface WhatsNextProps {
  title?: string;
  subtitle?: string;
  features?: FeatureItem[];
}

const WhatsNext = ({
  title = "What's Next",
  subtitle = "Exciting new features coming soon to enhance your financial management experience",
  features = [
    {
      title: "AI Chatbot Assistant",
      description:
        "Ask questions about your finances and get personalized insights and recommendations.",
      bulletPoints: [
        "Get answers to financial questions",
        "Navigate the app with voice commands",
        "Receive personalized financial advice",
        "Get help with budgeting and saving",
      ],
      icon: <MessageSquare className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800&q=80",
    },
    {
      title: "Smart Insights",
      description:
        "Get intelligent analysis of your spending patterns and financial habits.",
      bulletPoints: [
        "Identify spending trends and patterns",
        "Receive suggestions for saving opportunities",
        "Track progress toward financial goals",
        "Ask the chatbot for additional custom insights beyond standard graphs",
      ],
      icon: <BarChart3 className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    },
    {
      title: "Mobile App",
      description:
        "Access your financial information anytime, anywhere with our mobile app.",
      bulletPoints: [
        "Available on iOS and Android",
        "Sync data across all your devices",
        "Receive real-time notifications",
        "Toggle between Personal & Business accounts",
      ],
      icon: <Smartphone className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80",
    },
    {
      title: "MSME Insights",
      description:
        "Specialized financial tracking and insights for Micro, Small, and Medium Enterprises.",
      bulletPoints: [
        "Bookkeeping & financial statements",
        "Budgeting & forecasting tools",
        "Business performance metrics",
        "Tax preparation & financial analysis",
      ],
      icon: <BarChart3 className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    },
    {
      title: "Receipt Scanner",
      description:
        "Automatically extract expense details from photos or uploaded images of receipts.",
      bulletPoints: [
        "Scan receipts with your phone camera",
        "Auto-categorize expenses",
        "Store digital copies of receipts for tax purposes",
        "Export data for accounting software",
      ],
      icon: <Image className="h-6 w-6" />,
      imageSrc:
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80",
    },
  ],
}: WhatsNextProps) => {
  const [activeFeature, setActiveFeature] = useState<number>(0);

  const handleFeatureClick = (index: number) => {
    setActiveFeature(index);
  };

  return (
    <section id="whats-next" className="py-16 md:py-24 bg-[#FAF9F6]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center mb-12">
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
        </AnimatePresence>

        <div className="mt-8 text-center">
          <Button
            className="bg-[#0A3D62] hover:bg-[#0A3D62]/80 text-white rounded-md px-6 py-2 mt-4"
            onClick={() => (window.location.href = "/auth")}
          >
            Try Fintr <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default WhatsNext;
