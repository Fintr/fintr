"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { TrendingUp, MessageCircle, BarChart3 } from "lucide-react";

interface FinanceAssistantSectionProps {
  title?: string;
  subtitle?: string;
}

const FinanceAssistantSection = ({
  title = "Your Personal Finance Assistant",
  subtitle = "How Fintr helps you take control of your money.",
}: FinanceAssistantSectionProps) => {
  const solutions = [
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Simplify Tracking Your Money",
      subtitle: "Just take a photo of your receipt, Fintr labels and logs it for you.",
      bgColor: "#e6eef7",
    },
    {
      icon: <MessageCircle className="h-8 w-8" />,
      title: "Get Personalized Money Answers",
      subtitle: "Ask questions like \"can I afford this?\" or \"should I pay off my loan first?\". Fintr gives answers based on your own data.",
      bgColor: "#cac7da",
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Make Smarter Financial Decisions",
      subtitle: "Thinking of taking a loan, getting an insurance, or buying a condo? Fintr figures out your options, and shows what you can truly afford.",
      bgColor: "#bfd2cd",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
              {title}
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              {subtitle}
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {solutions.map((solution, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full border-0 hover:shadow-lg transition-shadow duration-300" style={{ backgroundColor: solution.bgColor }}>
                <CardHeader className="text-center pt-8">
                  <div className="inline-flex items-center justify-center text-primary mx-auto mb-6">
                    {solution.icon}
                  </div>
                  <CardTitle className="text-xl font-semibold text-primary leading-tight mb-4">
                    {solution.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-primary text-base leading-relaxed">
                    {solution.subtitle}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FinanceAssistantSection;
