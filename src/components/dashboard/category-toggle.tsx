import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Wallet, Target, TrendingUp, CreditCard } from "lucide-react";

export type CategoryType =
  | "expense"
  | "income"
  | "goal"
  | "investment"
  | "account";

interface CategoryToggleProps {
  activeCategory: CategoryType;
  onCategoryChange: (category: CategoryType) => void;
}

const CategoryToggle: React.FC<CategoryToggleProps> = ({
  activeCategory,
  onCategoryChange,
}) => {
  return (
    <div className="mb-6">
      <Tabs
        defaultValue={activeCategory}
        value={activeCategory}
        onValueChange={(value) => onCategoryChange(value as CategoryType)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full bg-background">
          <TabsTrigger
            value="expense"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Expense</span>
          </TabsTrigger>
          <TabsTrigger
            value="income"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Income</span>
          </TabsTrigger>
          <TabsTrigger
            value="goal"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Goal</span>
          </TabsTrigger>
          <TabsTrigger
            value="investment"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Investment</span>
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};

export default CategoryToggle;
