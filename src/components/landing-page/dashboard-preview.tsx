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
import { Button } from "../ui/button";
import {
  BarChart3,
  PieChart,
  LineChart,
  ArrowRight,
  Calendar,
  Wallet,
  Target,
  CreditCard,
} from "lucide-react";
import { Progress } from "../ui/progress";

interface DashboardPreviewProps {
  title?: string;
  subtitle?: string;
}

const DashboardPreview = ({
  title = "Experience the Dashboard",
  subtitle = "Get a glimpse of our powerful finance tracking tools",
}: DashboardPreviewProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <section className="py-16 md:py-24 bg-[#F7F2E7]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#0A3D62]">
            {title}
          </h2>
          <p className="text-lg text-[#0A3D62] leading-relaxed mb-6">
            {subtitle}
          </p>
          <Button
            className="bg-[#0A3D62] hover:bg-[#0A3D62]/80 text-white px-6 py-2"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Account Dashboard
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[#FAF9F6] rounded-xl shadow-xl overflow-hidden"
        >
          {/* Mock Dashboard Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <img
                  src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png"
                  alt="Fintr Logo"
                  className="h-8 w-auto"
                />
              </div>
              {/* 'Try It Now' button removed */}
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="p-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[#0A3D62]/70">
                    Total Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#0A3D62]">
                    {formatCurrency(40000)}
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    +5.2% from last month
                  </p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[#0A3D62]/70">
                    Monthly Income
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#0A3D62]">
                    {formatCurrency(80000)}
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    +2.1% from last month
                  </p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[#0A3D62]/70">
                    Monthly Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#0A3D62]">
                    {formatCurrency(40000)}
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    +8.4% from last month
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Expense Breakdown Chart */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                  <CardDescription>
                    Your spending by category this month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 flex flex-col items-center justify-center">
                    {/* Mock Pie Chart */}
                    <div className="relative w-48 h-48 mb-6">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {/* Income Slice - 53% */}
                        <path
                          d="M 50 50 L 50 5 A 45 45 0 0 1 95 50 Z"
                          fill="#008080"
                        />
                        {/* Expenses Slice - 27% */}
                        <path
                          d="M 50 50 L 95 50 A 45 45 0 0 1 50 95 Z"
                          fill="#FF6F61"
                        />
                        {/* Loan Slice - 20% */}
                        <path
                          d="M 50 50 L 50 95 A 45 45 0 0 1 5 50 A 45 45 0 0 1 50 5 Z"
                          fill="#D6A3A1"
                        />
                      </svg>
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-[#D6A3A1] rounded-full mr-2"></div>
                        <div className="flex flex-col">
                          <span className="text-xs text-[#0A3D62] font-medium">
                            Income
                          </span>
                          <span className="text-xs text-[#0A3D62]/70">
                            {formatCurrency(80000)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-[#FF6F61] rounded-full mr-2"></div>
                        <div className="flex flex-col">
                          <span className="text-xs text-[#0A3D62] font-medium">
                            Expenses
                          </span>
                          <span className="text-xs text-[#0A3D62]/70">
                            {formatCurrency(40000)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-[#008080] rounded-full mr-2"></div>
                        <div className="flex flex-col">
                          <span className="text-xs text-[#0A3D62] font-medium">
                            Loan
                          </span>
                          <span className="text-xs text-[#0A3D62]/70">
                            {formatCurrency(40000)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Goals */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>Financial Goals</CardTitle>
                  <CardDescription>
                    Track progress towards your financial targets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-[#0A3D62] flex items-center">
                            <Target className="h-4 w-4 mr-2 text-[#0A3D62]" />
                            Emergency Fund
                          </h3>
                          <p className="text-sm text-[#0A3D62]/70">
                            Target: {formatCurrency(100000)} by Dec 2023
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full text-red-600 bg-opacity-10">
                          High
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>
                            {formatCurrency(45000)} of {formatCurrency(100000)}
                          </span>
                          <span>45%</span>
                        </div>
                        <Progress value={45} className="h-2" />
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-[#0A3D62] flex items-center">
                            <Target className="h-4 w-4 mr-2 text-[#0A3D62]" />
                            Car Down Payment
                          </h3>
                          <p className="text-sm text-[#0A3D62]/70">
                            Target: {formatCurrency(200000)} by Jun 2024
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full text-amber-600 bg-opacity-10">
                          Medium
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>
                            {formatCurrency(80000)} of {formatCurrency(200000)}
                          </span>
                          <span>40%</span>
                        </div>
                        <Progress value={40} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feature Icons */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col items-center text-center cursor-pointer hover:shadow-md transition-shadow">
                <div className="bg-[#0A3D62] text-white p-3 rounded-full mb-3">
                  <Wallet className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-[#0A3D62]">Track Expenses</h3>
                <p className="text-xs text-[#0A3D62]/70 mt-1">
                  Monitor all your spending
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col items-center text-center cursor-pointer hover:shadow-md transition-shadow">
                <div className="bg-[#0A3D62] text-white p-3 rounded-full mb-3">
                  <Target className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-[#0A3D62]">Set Goals</h3>
                <p className="text-xs text-[#0A3D62]/70 mt-1">
                  Create and track financial goals
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col items-center text-center cursor-pointer hover:shadow-md transition-shadow">
                <div className="bg-[#0A3D62] text-white p-3 rounded-full mb-3">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-[#0A3D62]">Manage Loans</h3>
                <p className="text-xs text-[#0A3D62]/70 mt-1">
                  Track borrowed and lent money
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col items-center text-center cursor-pointer hover:shadow-md transition-shadow">
                <div className="bg-[#0A3D62] text-white p-3 rounded-full mb-3">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-[#0A3D62]">Get Insights</h3>
                <p className="text-xs text-[#0A3D62]/70 mt-1">
                  AI-powered financial analysis
                </p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <Button
                className="bg-[#0A3D62] hover:bg-[#0A3D62]/80 text-white px-6 py-2"
                onClick={() => {
                  // Open expandable preview linked to Dashboard
                  const previewModal = document.createElement("div");
                  previewModal.className =
                    "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
                  previewModal.innerHTML = `
                    <div class="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
                      <div class="flex justify-between items-center p-4 border-b">
                        <h3 class="text-xl font-bold text-[#0A3D62]">Fintr Dashboard Preview</h3>
                        <button id="close-preview" class="text-gray-500 hover:text-gray-700">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                      <div class="flex-grow overflow-auto">
                        <iframe src="/dashboard?preview=true" class="w-full h-full border-0"></iframe>
                      </div>
                      <div class="p-4 border-t bg-gray-50 flex justify-between items-center">
                        <p class="text-sm text-[#0A3D62]/70">Experience the dashboard without signing up</p>
                        <button id="try-full-version" class="bg-[#0A3D62] hover:bg-[#0A3D62]/80 text-white px-4 py-2 rounded-md text-sm">Try Full Version</button>
                      </div>
                    </div>
                  `;
                  document.body.appendChild(previewModal);

                  // Add event listeners
                  document
                    .getElementById("close-preview")
                    ?.addEventListener("click", () => {
                      document.body.removeChild(previewModal);
                    });

                  document
                    .getElementById("try-full-version")
                    ?.addEventListener("click", () => {
                      window.location.href = "/auth";
                    });
                }}
              >
                Try Fintr <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DashboardPreview;
