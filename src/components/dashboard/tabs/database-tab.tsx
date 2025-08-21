import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Folder, Users, Settings, Upload, Download, Pencil, Plus } from "lucide-react";
import CategoryToggle, { CategoryToggleType } from "../category-toggle";
import CategoryListCard from "../category-list-card";
import AccountList from "../account-list";
import AddAccountForm, { NewAccountData } from "../add-account-form";
import CategoryFormDialog from "../category-form-dialog";
import DeleteCategoryDialog from "../delete-category-dialog";
import { useTransactionCategories } from "@/hooks/async/useTransactionCategories";
import { useAccounts } from "@/hooks/async/useAccounts";
import { getColor, shouldShowV2Features } from "@/lib/utils";
import { TransactionCategory } from "@/types/transactionCategoryTypes";
import { Account } from "@/types/accountTypes";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { CategoryTypeEnum } from "@/types/categoryTypes";

// Define CategoryItem interface to match CategoryListCard expectations
interface CategoryItem {
  id: string;
  name: string;
  color?: string;
  amount?: number;
  budget?: number;
  [key: string]: any; // For any additional properties
}

const DatabaseTab = () => {
  const [activeMainTab, setActiveMainTab] = useState("categories");
  const [activeSubTab, setActiveSubTab] = useState("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryToggleType>("expense");
  const showV2Features = shouldShowV2Features();

  // Fetch transaction categories from API
  const {
    expenseCategories,
    incomeCategories,
    isLoading: categoriesLoading,
    isError: categoriesError,
    updateCategoryMutation,
    deleteCategoryMutation,
    createCategoryMutation,
  } = useTransactionCategories();

  // Fetch accounts from API
  const {
    accounts,
    isLoading: accountsLoading,
    isError: accountsError
  } = useAccounts();

  // Default settings states
  const [defaultAccount, setDefaultAccount] = useState("BPI Savings");
  const [defaultTransactionType, setDefaultTransactionType] =
    useState("Expense");
  const [defaultViewMode, setDefaultViewMode] = useState("List View");
  const [defaultDateRange, setDefaultDateRange] = useState("Month");

  // Budget settings states
  const [defaultBudgetType, setDefaultBudgetType] = useState("Monthly");
  const [defaultBudgetView, setDefaultBudgetView] = useState("Categories");
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState("80");
  const [warnOnOverspend, setWarnOnOverspend] = useState(true);

  // Goals settings states
  const [defaultPriority, setDefaultPriority] = useState("Medium");
  const [defaultContributionIncrement, setDefaultContributionIncrement] =
    useState("1000");
  const [showCompletedGoals, setShowCompletedGoals] = useState(true);
  const [autoCalculateEndDate, setAutoCalculateEndDate] = useState(true);

  // Investment settings states
  const [defaultRiskLevel, setDefaultRiskLevel] = useState("Medium");
  const [returnRateThreshold, setReturnRateThreshold] = useState("3");
  const [defaultSortBy, setDefaultSortBy] = useState("Current Value");
  const [defaultSortDirection, setDefaultSortDirection] =
    useState("Descending");

  // Currency settings states
  const [currencySymbol, setCurrencySymbol] = useState("₱");
  const [currencyPosition, setCurrencyPosition] = useState(
    "Before Amount (₱100)",
  );
  const [thousandsSeparator, setThousandsSeparator] = useState("Comma (,)");
  const [decimalSeparator, setDecimalSeparator] = useState("Period (.)");
  const [decimalPlaces, setDecimalPlaces] = useState("2");

  // Export/Import states
  const [selectedExportItems, setSelectedExportItems] = useState({
    transactions: true,
    budgets: true,
    goals: true,
    investments: true,
    insights: true,
    accounts: true,
    settings: true,
  });

  const [importFormat, setImportFormat] = useState("JSON (Recommended)");

  // Transform API data to match component expectations
  const transformedExpenseCategories = expenseCategories.map((category: TransactionCategory) => ({
    id: category.id,
    name: category.name,
    color: category.color || getColor(),
    type: "expense",
  }));

  const transformedIncomeCategories = incomeCategories.map((category: TransactionCategory) => ({
    id: category.id,
    name: category.name,
    color: category.color || getColor(),
    type: "income",
  }));

  // Category data - mix of API data and mock data for other types
  const categories = {
    expense: transformedExpenseCategories,
    income: transformedIncomeCategories,
    goal: showV2Features ? [
      {
        id: "7",
        name: "Debt Pay-Off",
        budget: 100000,
        color: "#FF9800",
        type: "goal",
      },
      {
        id: "8",
        name: "Emergency",
        budget: 50000,
        color: "#E91E63",
        type: "goal",
      },
      {
        id: "9",
        name: "Retirement",
        budget: 300000,
        color: "#673AB7",
        type: "goal",
      },
      {
        id: "g4",
        name: "Home",
        budget: 200000,
        color: "#4CAF50",
        type: "goal",
      },
      {
        id: "g5",
        name: "Education",
        budget: 75000,
        color: "#2196F3",
        type: "goal",
      },
      {
        id: "g6",
        name: "Investment",
        budget: 50000,
        color: "#9C27B0",
        type: "goal",
      },
      {
        id: "g7",
        name: "Stocks",
        budget: 100000,
        color: "#FF9800",
        type: "goal",
      },
      {
        id: "g8",
        name: "Mutual Funds",
        budget: 80000,
        color: "#E91E63",
        type: "goal",
      },
      {
        id: "g9",
        name: "Business",
        budget: 150000,
        color: "#673AB7",
        type: "goal",
      },
      {
        id: "g10",
        name: "Big Purchase",
        budget: 60000,
        color: "#795548",
        type: "goal",
      },
      {
        id: "g11",
        name: "Life Milestones",
        budget: 40000,
        color: "#607D8B",
        type: "goal",
      },
    ] : [],
    investment: showV2Features ? [
      {
        id: "10",
        name: "Insurance",
        budget: 50000,
        color: "#3F51B5",
        type: "investment",
      },
      {
        id: "18a",
        name: "Business",
        budget: 150000,
        color: "#673AB7",
        type: "investment",
      },
      {
        id: "21a",
        name: "Real Estate",
        budget: 200000,
        color: "#4CAF50",
        type: "investment",
      },
      {
        id: "16a",
        name: "Stocks",
        budget: 100000,
        color: "#FF9800",
        type: "investment",
      },
      {
        id: "17a",
        name: "Mutual Funds",
        budget: 80000,
        color: "#E91E63",
        type: "investment",
      },
    ] : [],
  };

  // const handleAddCategory = () => {
  //   if (newCategoryName.trim() === "") return;
  //   // Logic to add a new category would go here
  //   setNewCategoryName("");
  // };

  // const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   if (e.target.files && e.target.files.length > 0) {
  //     setSelectedFile(e.target.files[0]);
  //   }
  // };

  // const handleFileUpload = () => {
  //   if (!selectedFile) {
  //     // Show error or notification that no file is selected
  //     console.log("No file selected");
  //     return;
  //   }

  //   setIsUploading(true);
  //   // Simulate upload process
  //   setTimeout(() => {
  //     console.log(`Uploading file: ${selectedFile.name}`);
  //     // Here you would handle the actual file upload logic
  //     setIsUploading(false);
  //     setSelectedFile(null);
  //     // Reset file input
  //     const fileInput = document.getElementById(
  //       "file-upload",
  //     ) as HTMLInputElement;
  //     if (fileInput) fileInput.value = "";
  //   }, 1500);
  // };

  // const handleExportData = () => {
  //   setIsExporting(true);
  //   // Simulate export process
  //   setTimeout(() => {
  //     console.log("Exporting data as CSV");
  //     // Here you would handle the actual export logic
  //     setIsExporting(false);

  //     // Create a mock CSV download
  //     const csvContent =
  //       "data:text/csv;charset=utf-8,Date,Category,Amount\n2023-06-01,Groceries,120.50\n2023-06-02,Utilities,85.75";
  //     const encodedUri = encodeURI(csvContent);
  //     const link = document.createElement("a");
  //     link.setAttribute("href", encodedUri);
  //     link.setAttribute("download", "financial_data.csv");
  //     document.body.appendChild(link);
  //     link.click();
  //     document.body.removeChild(link);
  //   }, 1500);
  // };

  // Functions for category management
  const handleEditCategory = (item: CategoryItem) => {
    console.log("Edit category:", item);
    // This will now be handled by the CategoryFormDialog component
  };

  const handleDeleteCategory = (item: CategoryItem) => {
    console.log("Delete category:", item);
    // This will now be handled by the DeleteCategoryDialog component
  };

  // const handleAddExpenseCategory = () => {
  //   console.log("Add expense category");
  //   // Implement add expense category functionality
  // };

  // const handleAddIncomeCategory = () => {
  //   console.log("Add income category");
  //   // Implement add income category functionality
  // };

  const handleCreateCategory = async (name: string, categoryType: CategoryTypeEnum) => {
    try {
      await createCategoryMutation.mutateAsync({ name, categoryType });
      // No toast here, it's handled in the dialog
    } catch (error) {
      console.error("Failed to create category:", error);
      throw error; // Re-throw so the dialog can handle the error
    }
  };

  const handleAddGoalCategory = () => {
    console.log("Add goal category");
    // Implement add goal category functionality
  };

  const handleAddInvestmentCategory = () => {
    console.log("Add investment category");
    // Implement add investment category functionality
  };

  const handleAddAccount = (accountData: NewAccountData) => {
    // Account creation is now handled by the AddAccountForm component with useAccounts hook
    console.log("Account added:", accountData);
  };

  const handleEditAccount = (account: Account) => {
    console.log("Edit account:", account);
    // Implement edit functionality
    // For now, we'll just log the account to be edited
  };

  const handleDeleteAccount = (account: Account) => {
    // Remove the account from the accounts array
    // This will now be handled by the useAccounts hook
  };

  const handleUpdateCategory = async (categoryId: string, newName: string) => {
    try {
      await updateCategoryMutation.mutateAsync({
        categoryId,
        updateData: { name: newName }
      });
    } catch (error) {
      console.error("Failed to update category:", error);
      throw error; // Re-throw so the dialog can handle the error
    }
  };

  const handleDeleteCategoryAction = async (categoryId: string) => {
    // We wrap this in a promise to ensure the dialog's onDelete always receives a resolved promise
    // allowing it to check the `success` property directly.
    return new Promise((resolve, reject) => {
      deleteCategoryMutation.mutate(categoryId, {
        onSuccess: (data) => {
          // Data here is the response from deleteTransactionCategory (e.g., { success: true, ... } or { success: false, error: ... })
          resolve(data);
        },
        onError: (error) => {
          // This onError is for network errors or unhandled exceptions from the mutationFn.
          // If the backend returns a 4xx/5xx with a body like {success: false, ...},
          // it should be caught by the mutationFn and returned as data on success.
          console.error("Mutation execution failed (network/unhandled error):");
          reject(error);
        },
      });
    });
  };

  // Create custom edit component for categories
  const renderCategoryEdit = (item: CategoryItem) => (
    <CategoryFormDialog
      category={item}
      onUpdate={handleUpdateCategory}
      isLoading={updateCategoryMutation.isLoading}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:bg-blue-50"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      }
    />
  );

  // Create custom add component for categories
  const renderCategoryAdd = (categoryType: CategoryTypeEnum) => (
    <CategoryFormDialog
      categoryType={categoryType}
      onAdd={handleCreateCategory}
      isLoading={createCategoryMutation.isLoading}
      trigger={
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-md transition-all duration-300 ease-in-out transform hover:scale-[1.01] w-full"
        >
          <Plus className="mr-2 h-5 w-5" /> Add New {categoryType === CategoryTypeEnum.EXPENSE ? 'Expense' : 'Income'} Category
        </Button>
      }
    />
  );

  // Create custom delete component for categories
  const renderCategoryDelete = (item: CategoryItem) => (
    <DeleteCategoryDialog
      category={item}
      onDelete={handleDeleteCategoryAction}
      isLoading={deleteCategoryMutation.isLoading}
    />
  );

  // Show loading state while fetching categories
  if (categoriesLoading) {
    return (
      <div className="py-4 text-center w-full">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  // Show error state if categories failed to load
  if (categoriesError) {
    return (
      <Card className="border-0 shadow-none bg-background">
        <CardHeader>
          <CardTitle>Settings & Configurations</CardTitle>
          <CardDescription>
            Error loading categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-red-500 mb-4">Failed to load categories. Please try again.</p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-background">
      <CardHeader className="px-0">
        <CardTitle>Settings & Configurations</CardTitle>
        <CardDescription>
          Manage your financial data settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {/* Main Navigation Buttons */}
        <div className="flex space-x-2 mb-6 overflow-x-auto">
          <Button
            variant={activeMainTab === "categories" ? "default" : "outline"}
            className={activeMainTab === "categories" ? "bg-primary" : "bg-white"}
            onClick={() => setActiveMainTab("categories")}
          >
            <Folder className="h-4 w-4 mr-2" /> Categories
          </Button>
          <Button
            variant={activeMainTab === "accounts" ? "default" : "outline"}
            className={activeMainTab === "accounts" ? "bg-primary" : "bg-white"}
            onClick={() => setActiveMainTab("accounts")}
          >
            <Users className="h-4 w-4 mr-2" /> Accounts
          </Button>
        </div>

        {/* Categories Tab Content */}
        {activeMainTab === "categories" && (
          <>
            <h3 className="text-xl font-medium mb-4">
              Category Management
            </h3>
            <p className="text-gray-500 mb-4">
              Manage your categories for expenses, income, goals,
              investments, and accounts
            </p>

            <div className="mb-6">
              <CategoryToggle
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
            </div>

            {activeCategory === "expense" && (
              <CategoryListCard
                title="Expense Categories"
                description="Manage your expense categories"
                items={categories["expense"]}
                onAddItem={() => {}} // Dummy function, actual dialog is rendered via customAddComponent
                onEditItem={handleEditCategory}
                onDeleteItem={handleDeleteCategory}
                colorField="color"
                primaryField="name"
                addButtonText="Add New Expense Category"
                customEditComponent={renderCategoryEdit}
                customAddComponent={renderCategoryAdd(CategoryTypeEnum.EXPENSE)}
                customDeleteComponent={renderCategoryDelete}
              />
            )}

            {activeCategory === "income" && (
              <CategoryListCard
                title="Income Categories"
                description="Manage your income categories"
                items={categories["income"]}
                onAddItem={() => {}} // Dummy function, actual dialog is rendered via customAddComponent
                onEditItem={handleEditCategory}
                onDeleteItem={handleDeleteCategory}
                colorField="color"
                primaryField="name"
                addButtonText="Add New Income Category"
                customEditComponent={renderCategoryEdit}
                customAddComponent={renderCategoryAdd(CategoryTypeEnum.INCOME)}
                customDeleteComponent={renderCategoryDelete}
              />
            )}

            {activeCategory === "goal" && (
              <CategoryListCard
                title="Goal Categories"
                description="Manage your goal categories"
                items={categories["goal"]}
                onAddItem={handleAddGoalCategory}
                onEditItem={handleEditCategory}
                onDeleteItem={handleDeleteCategory}
                colorField="color"
                primaryField="name"
                addButtonText="Add New Goal Category"
                customEditComponent={renderCategoryEdit}
                customDeleteComponent={renderCategoryDelete}
              />
            )}

            {activeCategory === "investment" && (
              <CategoryListCard
                title="Investment Categories"
                description="Manage your investment categories"
                items={categories["investment"]}
                onAddItem={handleAddInvestmentCategory}
                onEditItem={handleEditCategory}
                onDeleteItem={handleDeleteCategory}
                colorField="color"
                primaryField="name"
                addButtonText="Add New Investment Category"
                customEditComponent={renderCategoryEdit}
                customDeleteComponent={renderCategoryDelete}
              />
            )}
          </>
        )}

        {/* Accounts Tab Content */}
        {activeMainTab === "accounts" && (
          <>
            <h3 className="text-xl font-medium mb-4">
              Account Management
            </h3>
            <p className="text-gray-500 mb-4">
              Manage your financial accounts, track balances, and organize
              your money
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-white p-4 rounded-md border border-gray-200 h-fit">
                <AddAccountForm onAddAccount={handleAddAccount} />
              </div>

              <div className="md:col-span-2">
                {accountsLoading ? (
                  <div className="text-center py-8 w-full">
                    <LoadingSpinner size="medium" />
                  </div>
                ) : accountsError ? (
                  <p className="text-red-500 text-center py-4">
                    Error loading accounts. Please try again.
                  </p>
                ) : accounts.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No accounts found. Add your first account to get started.
                  </p>
                ) : (
                  <AccountList accounts={accounts} />
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseTab;
