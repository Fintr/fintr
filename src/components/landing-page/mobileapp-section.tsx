"use client";
import React from "react";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { ArrowRight, Smartphone, Download, Bell, Zap } from "lucide-react";

interface MobileAppSectionProps {
  title?: string;
  subtitle?: string;
}

const MobileAppSection = ({
  title = "Fintr Mobile App Coming Soon",
  subtitle = "Take your financial freedom journey on the go with our upcoming mobile application",
}: MobileAppSectionProps) => {
  const features = [
    {
      icon: <Smartphone className="h-10 w-10 text-primary" />,
      title: "Native Mobile Experience",
      description:
        "Enjoy a seamless, native mobile experience designed specifically for iOS and Android devices.",
    },
    {
      icon: <Bell className="h-10 w-10 text-primary" />,
      title: "Real-time Notifications",
      description:
        "Get instant alerts for transactions, budget limits, and financial insights wherever you are.",
    },
    {
      icon: <Download className="h-10 w-10 text-primary" />,
      title: "Offline Access",
      description:
        "Access your financial data even without an internet connection and sync when you're back online.",
    },
    {
      icon: <Zap className="h-10 w-10 text-primary" />,
      title: "Quick Capture",
      description:
        "Scan receipts and invoices with your camera for instant transaction recording and categorization.",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[#F7F2E7]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
            {title}
          </h2>
          <p className="text-lg text-primary max-w-3xl mx-auto">{subtitle}</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="md:w-1/2 order-2 md:order-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold mb-2 text-primary">
                    {feature.title}
                  </h3>
                  <p className="text-primary/80">{feature.description}</p>
                </motion.div>
              ))}
            </div>

            {/* Waitlist button removed for cleaner look */}
          </div>

          <div className="md:w-1/2 order-1 md:order-2 mb-8 md:mb-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="relative mx-auto w-72 md:w-[320px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-[#3D8D7F] rounded-[40px] blur-xl opacity-20 transform -rotate-6"></div>
              <div className="relative bg-primary rounded-[40px] p-4 shadow-xl transform rotate-6">
                <div className="bg-white rounded-[32px] overflow-hidden h-[540px] flex flex-col">
                  <div className="h-12 bg-primary flex items-center justify-center">
                    <div className="w-20 h-6 bg-black rounded-b-xl"></div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-center mb-4 mt-2">
                      <img
                        src="https://raw.githubusercontent.com/paoloparaiso/Fintr/989e1801f94417a722a0b7e6eb4b1b56b05b9616/Fintr_Logo.png"
                        alt="Fintr Logo"
                        className="h-10"
                      />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <h3 className="text-primary font-bold text-sm mb-2">
                        Insights Dashboard
                      </h3>

                      {/* Financial Health Score */}
                      <div className="bg-[#f9f7f5] p-2 rounded-lg mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-primary">
                            Financial Health
                          </span>
                          <span className="text-xs font-bold text-primary">
                            78/100
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{ width: "78%" }}
                          ></div>
                        </div>
                      </div>

                      {/* Spending by Category */}
                      <div className="space-y-2 mb-3">
                        <h4 className="text-xs font-medium text-primary">
                          Top Spending Categories
                        </h4>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full mr-1 bg-[var(--teal-600)]"></div>
                            <span className="text-xs">Food</span>
                          </div>
                          <span className="text-xs">₱8,500</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full mr-1 bg-[#3D8D7F]"></div>
                            <span className="text-xs">House</span>
                          </div>
                          <span className="text-xs">₱7,500</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full mr-1 bg-[#CC5500]"></div>
                            <span className="text-xs">Shopping</span>
                          </div>
                          <span className="text-xs">₱6,200</span>
                        </div>
                      </div>

                      {/* AI Insight */}
                      <div className="bg-primary/5 p-2 rounded-lg border border-primary/10 mb-3">
                        <div className="flex items-start">
                          <div className="bg-primary text-white p-1 rounded-full mr-2 flex-shrink-0">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="text-[10px] text-primary/70">
                              You've spent 24% more on dining out this month.
                              Consider setting a specific budget for
                              restaurants.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 mt-auto">
                      <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 mb-3">
                        <p className="text-[11px] text-primary font-medium italic text-center">
                          "Take control of your money to achieve your own
                          financial freedom, wherever you may be."
                        </p>
                      </div>
                      <button className="w-full bg-white text-primary border-2 border-primary rounded-full py-2 font-medium text-sm">
                        Sign In
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MobileAppSection;
