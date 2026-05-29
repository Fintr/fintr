import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Wallet, Target, TrendingUp } from "lucide-react";
import { shouldShowV2Features } from "@/lib/utils";

export type CategoryToggleType =
  | "expense"
  | "income"
  | "goal"
  | "investment";

interface CategoryToggleProps {
  activeCategory: CategoryToggleType;
  onCategoryChange: (category: CategoryToggleType) => void;
}

const CategoryToggle: React.FC<CategoryToggleProps> = ({
  activeCategory,
  onCategoryChange,
}) => {
  const showV2Features = shouldShowV2Features();
  
  // Ensure we don't have an invalid active category when V2 features are disabled
  React.useEffect(() => {
    if (!showV2Features && (activeCategory === "goal" || activeCategory === "investment")) {
      onCategoryChange("expense");
    }
  }, [showV2Features, activeCategory, onCategoryChange]);

  return (
    <div className="mb-6">
      <Tabs
        defaultValue={activeCategory}
        value={activeCategory}
        onValueChange={(value) => onCategoryChange(value as CategoryToggleType)}
        className="w-full"
      >
        <TabsList className="grid h-full w-full grid-cols-2 rounded-md bg-white md:grid-cols-4">
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
          {showV2Features && (
            <>
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
            </>
          )}
        </TabsList>
      </Tabs>
    </div>
  );
};

export default CategoryToggle;
