'use client'

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";

import BudgetsTab from "@/components/dashboard/tabs/budgets-tab";
import DatabaseTab from "@/components/dashboard/tabs/database-tab";
import InvestmentsTab from "@/components/dashboard/tabs/investments-tab";
import InsightsTab from "@/components/dashboard/tabs/insights-tab";
import GoalSection from "@/components/dashboard/goals-section";
import useAuthApi from "@/hooks/useAuthApi";
import { useQuery } from "@tanstack/react-query";
import { getFirstDayOfMonth, getLastDayOfMonth } from "@/utils/dateUtils";
import { cn, formatCurrency } from "@/lib/utils";
import dynamic from "next/dynamic";

// @ts-ignore
const useGetSpaceCode = dynamic(() => import("@/hooks/useGetSpaceCode"), {
  ssr: false,
});
const TransactionsTab = dynamic(() => import("@/components/dashboard/tabs/transactions-tab"), {
  ssr: false,
});

const TrackerDashboard = () => {
  const [activeTab, setActiveTab] = useState("transactions");

  // State for transaction filtering
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentYear = new Date().getFullYear().toString();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [startYear, setStartYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [endYear, setEndYear] = useState(currentYear);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [budgets, setBudgets] = useState<any[]>([]);

  const [categories, setCategories] = useState([
    {
      name: "Food",
      spent: 8500,
      budget: 10000,
      color: "#008080",
      subcategories: [
        { name: "Groceries", spent: 5000, budget: 6000 },
        { name: "Dining Out", spent: 3500, budget: 4000 },
      ],
    },
    {
      name: "Transportation",
      spent: 3200,
      budget: 5000,
      color: "#D6A3A1",
      subcategories: [
        { name: "Fuel", spent: 1800, budget: 3000 },
        { name: "Public Transit", spent: 1400, budget: 2000 },
      ],
    },
    {
      name: "Entertainment",
      spent: 2800,
      budget: 3000,
      color: "#FF6F61",
      subcategories: [
        { name: "Movies", spent: 800, budget: 1000 },
        { name: "Subscriptions", spent: 2000, budget: 2000 },
      ],
    },
    {
      name: "Utilities",
      spent: 4500,
      budget: 6000,
      color: "#800020",
      subcategories: [
        { name: "Electricity", spent: 2500, budget: 3000 },
        { name: "Water", spent: 800, budget: 1000 },
        { name: "Internet", spent: 1200, budget: 2000 },
      ],
    },
    {
      name: "Shopping",
      spent: 6200,
      budget: 5000,
      color: "#CC5500",
      subcategories: [
        { name: "Clothing", spent: 3500, budget: 2500 },
        { name: "Electronics", spent: 2700, budget: 2500 },
      ],
    },
    {
      name: "House",
      spent: 7500,
      budget: 8000,
      color: "#3D8D7F",
      subcategories: [
        { name: "Rent", spent: 6000, budget: 6000 },
        { name: "Maintenance", spent: 1500, budget: 2000 },
      ],
    },
  ]);

  const { api } = useAuthApi({
    scope: "openid profile email read:transactions read:user",
  });

  useGetSpaceCode(api)

  // Helper functions for filtering
  const getMonthNumber = (monthName: string) => {
    const monthMap: { [key: string]: number } = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };
    return monthMap[monthName.toLowerCase()];
  };

  // Load mock transactions and explicitly trigger the query
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        // First try to get transactions from Supabase
        const result = await supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false });

        const { data, error } = result;

        if (error) throw error;

        if (data && data.length > 0) {
          setAllTransactions(data);
          setFilteredTransactions(data.slice(0, 10)); // Show most recent 10 by default
        } else {
          // If no data in Supabase, use mock data
          const { generateMockTransactions } = await import(
            "@/lib/mockData"
          );
          const mockData = generateMockTransactions();
          setAllTransactions(mockData);
          setFilteredTransactions(mockData.slice(0, 10)); // Show most recent 10 by default

          // Optionally save mock data to Supabase
          // This would be removed in production
          for (const transaction of mockData.slice(0, 50)) {
            // Only insert first 50 to avoid rate limits
            await supabase.from("transactions").insert([transaction]);
          }
        }
      } catch (error) {
        console.error("Error loading transactions:", error);
        // Fallback to local mock data if Supabase fails
        const { generateMockTransactions } = await import("@/lib/mockData");
        const mockData = generateMockTransactions();
        setAllTransactions(mockData);
        setFilteredTransactions(mockData.slice(0, 10));
      }
    };

    // Load transactions data
    loadTransactions();

    // React Query will automatically handle the API call when authenticated
  }, []);

  // Function to apply filters
  const applyFilters = () => {
    let filtered = [...allTransactions];

    // Filter by category if not 'all'
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (t) =>
          t.category?.toLowerCase() === selectedCategory.toLowerCase() ||
          t.subcategory?.toLowerCase() === selectedCategory.toLowerCase(),
      );
    }

    // Apply date filters
    const monthMap: { [key: string]: number } = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };

    const startMonthNum = monthMap[startMonth];
    const startYearNum = parseInt(startYear);
    const endMonthNum = monthMap[endMonth];
    const endYearNum = parseInt(endYear);

    const startDate = new Date(getFirstDayOfMonth(startYearNum, startMonthNum));
    const endDate = new Date(getLastDayOfMonth(endYearNum, endMonthNum));

    filtered = filtered.filter((t) => {
      const date = new Date(t.date);
      return date >= startDate && date <= endDate;
    });

    // Sort by date (newest first)
    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    setFilteredTransactions(filtered);
  };

  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            My Goal to Financial Freedom
          </h1>
          <p className="text-primary/70">
            Having enough passive income to cover my expenses and being able to
            travel 3 months a year.
          </p>
        </div>
        <div className="mt-4 md:mt-0">{/* Empty div to maintain layout */}</div>
      </div>
      <Tabs
        defaultValue="insights"
        className="w-full"
        onValueChange={setActiveTab}
        value={activeTab}
      >
        <TabsList className="grid grid-cols-6 md:w-[960px] mb-8 bg-white">
          <TabsTrigger
            value="transactions"
            className={cn({
              "bg-primary text-white": activeTab === "transactions",
            })}
          >
            Transactions
          </TabsTrigger>
          <TabsTrigger
            value="budgets"
            className={cn({
              "bg-primary text-white": activeTab === "budgets",
            })}
          >
            Budget
          </TabsTrigger>
          <TabsTrigger
            value="goals"
            className={cn({
              "bg-primary text-white": activeTab === "goals",
            })}
          >
            Goals
          </TabsTrigger>
          <TabsTrigger
            value="investments"
            className={cn({
              "bg-primary text-white": activeTab === "investments",
            })}
          >
            Investments
          </TabsTrigger>
          <TabsTrigger
            value="insights"
            className={cn({
              "bg-primary text-white": activeTab === "insights",
            })}
          >
            Insights
          </TabsTrigger>
          <TabsTrigger
            value="database"
            className={cn({
              "bg-primary text-white": activeTab === "database",
            })}
          >
            Database
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent
          value="transactions"
          className="space-y-6 grid grid-cols-1 gap-6"
        >
          <TransactionsTab />
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-6 grid grid-cols-1 gap-6">
          <GoalSection formatCurrency={formatCurrency} />
        </TabsContent>

        {/* Budgets Tab */}
        <TabsContent
          value="budgets"
          className="space-y-6 grid grid-cols-1 gap-6"
        >
          <BudgetsTab
            formatCurrency={formatCurrency}
            // categories={categories}
            // setCategories={setCategories}
          />
        </TabsContent>

        {/* Database Tab */}
        <TabsContent
          value="database"
          className="space-y-6 grid grid-cols-1 gap-6"
        >
          <DatabaseTab />
        </TabsContent>

        {/* Investments Tab */}
        <TabsContent
          value="investments"
          className="space-y-6 grid grid-cols-1 gap-6"
        >
          <InvestmentsTab formatCurrency={formatCurrency} />
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent
          value="insights"
          className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <InsightsTab
            formatCurrency={formatCurrency}
            categories={categories}
            filteredTransactions={filteredTransactions}
            applyFilters={applyFilters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackerDashboard;
