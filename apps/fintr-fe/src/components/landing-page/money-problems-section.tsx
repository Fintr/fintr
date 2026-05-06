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
import { HelpCircle, TrendingDown } from "lucide-react";

interface MoneyProblemsSectionProps {
  title?: string;
  subtitle?: string;
}

const MoneyProblemsSection = ({
  title = "Managing Money Feels So Hard?",
  subtitle = "Have you ever experienced any (or all) of these?",
}: MoneyProblemsSectionProps) => {
  const problems = [
    {
      icon: <HelpCircle className="h-8 w-8" />,
      title: "Don't know where your money goes?",
      subtitle: "You make enough money, but can't seem to save? You want to track your money, but don't know where to begin?",
      bgColor: "#e9a48b",
    },
    {
      icon: <span className="text-2xl font-bold">₱</span>,
      title: "Financial advice feels confusing or expensive for you?",
      subtitle: "You've asked family, friends or searched online, but nothing feels right for your situation. Hiring a financial expert? It just feels out of reach.",
      bgColor: "#eacccc",
    },
    {
      icon: <TrendingDown className="h-8 w-8" />,
      title: "Not sure if you can afford what you want?",
      subtitle: "You've made a purchase or plan without fully understanding your financial health, and it caused you problems later on.",
      bgColor: "#e4dbca",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-background">
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
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full border-0 hover:shadow-lg transition-shadow duration-300" style={{ backgroundColor: problem.bgColor }}>
                <CardHeader className="text-center pt-8 pb-4">
                  <div className="inline-flex items-center justify-center text-primary mx-auto mb-6">
                    {problem.icon}
                  </div>
                  <CardTitle className="text-xl font-semibold text-primary leading-tight mb-4">
                    {problem.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-primary text-base leading-relaxed">
                    {problem.subtitle}
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

export default MoneyProblemsSection;
