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
  List,
  Plus,
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
            {title}
          </h2>
          <p className="text-lg text-primary leading-relaxed mb-6">
            {subtitle}
          </p>
          <Button
            className="bg-primary hover:bg-primary/80 text-white px-6 py-2"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Try Dashboard
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-xl shadow-xl overflow-hidden border"
        >
          {/* Dashboard Header */}
          <div className="bg-white border-b p-6">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png"
                    alt="Fintr Logo"
                    className="h-8 w-auto"
                  />
                  <div>
                    <h1 className="text-xl font-semibold text-primary">Your Financial Journey</h1>
                    <p className="text-sm text-gray-600">Track your path to financial freedom</p>
                  </div>
                </div>
              </div>
              
              {/* Navigation Tabs */}
              <div className="border-b">
                <div className="flex space-x-1 overflow-x-auto">
                  <button className="px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary bg-gray-50 rounded-t-md">
                    Transactions
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary">
                    Budgets
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary">
                    Goals
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary">
                    Insights
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary">
                    Database
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="p-6 bg-gray-50">
            {/* Transaction Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  List
                </Button>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Transaction
                </Button>
              </div>
            </div>

            {/* Recent Transactions */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Recent Transactions
                </CardTitle>
                <CardDescription>
                  Your latest financial activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-900/20 rounded-full flex items-center justify-center">
                        <span className="text-red-900 text-sm font-medium">🍕</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Lunch at Pizza Palace</p>
                        <p className="text-sm text-gray-500">Food & Dining • Today</p>
                      </div>
                    </div>
                    <span className="text-red-900 font-semibold">-{formatCurrency(580)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-200 rounded-full flex items-center justify-center">
                        <span className="text-teal-600 text-sm font-medium">💰</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Salary Deposit</p>
                        <p className="text-sm text-gray-500">Income • Yesterday</p>
                      </div>
                    </div>
                    <span className="text-teal-600 font-semibold">+{formatCurrency(75000)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100/50 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-medium">🚌</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Bus Fare</p>
                        <p className="text-sm text-gray-500">Transportation • 2 days ago</p>
                      </div>
                    </div>
                    <span className="text-red-900 font-semibold">-{formatCurrency(25)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 text-sm font-medium">🛒</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Grocery Shopping</p>
                        <p className="text-sm text-gray-500">Shopping • 3 days ago</p>
                      </div>
                    </div>
                    <span className="text-red-900 font-semibold">-{formatCurrency(2450)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(72000)}
                  </div>
                  <p className="text-xs text-teal-600 mt-1 flex items-center">
                    <span className="mr-1">↗</span>
                    +5.2% from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Monthly Income
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(75000)}
                  </div>
                  <p className="text-xs text-teal-600 mt-1 flex items-center">
                    <span className="mr-1">↗</span>
                    +2.1% from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Monthly Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(3055)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This month so far
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Insights Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Spending Categories
                  </CardTitle>
                  <CardDescription>
                    Where your money goes this month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-900/80 rounded-full"></div>
                        <span className="text-sm">Food & Dining</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatCurrency(1830)}</div>
                        <div className="text-xs text-gray-500">60%</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm">Transportation</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatCurrency(825)}</div>
                        <div className="text-xs text-gray-500">27%</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span className="text-sm">Shopping</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatCurrency(400)}</div>
                        <div className="text-xs text-gray-500">13%</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Financial Goals
                  </CardTitle>
                  <CardDescription>
                    Track your progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Emergency Fund</span>
                        <span className="text-sm text-gray-500">45%</span>
                      </div>
                      <Progress value={45} className="h-2" />
                      <div className="text-xs text-gray-500">
                        {formatCurrency(45000)} of {formatCurrency(100000)}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">New Laptop</span>
                        <span className="text-sm text-gray-500">68%</span>
                      </div>
                      <Progress value={68} className="h-2" />
                      <div className="text-xs text-gray-500">
                        {formatCurrency(34000)} of {formatCurrency(50000)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Call to Action */}
            <div className="mt-8 text-center">
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to take control of your finances?
                </h3>
                <p className="text-gray-600 mb-4">
                  Join thousands of users who are already managing their money smarter with Fintr.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    className="bg-primary hover:bg-primary/80 text-white px-6 py-2"
                    onClick={() => (window.location.href = "/auth")}
                  >
                    Get Started Free
                  </Button>
                  <Button
                    variant="outline"
                    className="px-6 py-2"
                    onClick={() => (window.location.href = "/dashboard")}
                  >
                    View Live Demo <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DashboardPreview;
