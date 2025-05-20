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
import { Folder, Users, Settings, Upload, Download } from "lucide-react";
import CategoryToggle, { CategoryType } from "../category-toggle";
import CategoryListCard from "../category-list-card";
import AccountList, { Account } from "../account-list";
import AddAccountForm, { NewAccountData } from "../add-account-form";

const DatabaseTab = () => {
  const [activeMainTab, setActiveMainTab] = useState("categories");
  const [activeSubTab, setActiveSubTab] = useState("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryType>("expense");

  // Accounts state
  const [accounts, setAccounts] = useState<Account[]>([
    {
      id: "acc1",
      name: "BPI Savings",
      type: "Bank Account",
      balance: 42650,
      color: "#1E3A8A",
    },
    {
      id: "acc2",
      name: "BDO Savings",
      type: "Bank Account",
      balance: 15300,
      color: "#166534",
    },
    {
      id: "acc3",
      name: "BPI Credit Card",
      type: "Credit Card",
      balance: -12400,
      color: "#1E3A8A",
    },
    {
      id: "acc4",
      name: "GCash",
      type: "Digital Wallet",
      balance: 6250,
      color: "#2563EB",
    },
  ]);

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

  // Category data
  const categories = {
    expense: [
      { id: "1", name: "Myself", color: "#008080", type: "expense" },
      { id: "2", name: "Family", color: "#D6A3A1", type: "expense" },
      { id: "3", name: "Insurance", color: "#FF6F61", type: "expense" },
      { id: "4", name: "Home", color: "#4CAF50", type: "expense" },
      { id: "5", name: "Utilities", color: "#2196F3", type: "expense" },
      { id: "6", name: "Food", color: "#9C27B0", type: "expense" },
      { id: "7", name: "Transport", color: "#FF9800", type: "expense" },
      { id: "8", name: "Pet", color: "#E91E63", type: "expense" },
      { id: "9", name: "Subscriptions", color: "#673AB7", type: "expense" },
      { id: "10", name: "Going Out", color: "#3F51B5", type: "expense" },
      { id: "11", name: "Travel", color: "#009688", type: "expense" },
      { id: "12", name: "Shopping", color: "#FF5722", type: "expense" },
    ],
    income: [
      {
        id: "4",
        name: "Salary",
        budget: 50000,
        color: "#4CAF50",
        type: "income",
      },
      {
        id: "5",
        name: "Freelance",
        budget: 10000,
        color: "#2196F3",
        type: "income",
      },
      {
        id: "6",
        name: "Business",
        budget: 5000,
        color: "#9C27B0",
        type: "income",
      },
    ],
    goal: [
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
    ],
    investment: [
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
    ],
    account: [
      {
        id: "13",
        name: "Cash",
        budget: 5000,
        color: "#795548",
        type: "account",
      },
      {
        id: "14",
        name: "Savings",
        budget: 100000,
        color: "#607D8B",
        type: "account",
      },
      {
        id: "15",
        name: "Debit",
        budget: 25000,
        color: "#4CAF50",
        type: "account",
      },
      {
        id: "16",
        name: "Credit Card",
        budget: -15000,
        color: "#F44336",
        type: "account",
      },
      {
        id: "17",
        name: "E-Wallet",
        budget: 8000,
        color: "#2196F3",
        type: "account",
      },
      {
        id: "18",
        name: "Loan",
        budget: -50000,
        color: "#FF5722",
        type: "account",
      },
      {
        id: "19",
        name: "Investment",
        budget: 75000,
        color: "#9C27B0",
        type: "account",
      },
    ],
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
  const handleEditCategory = (category: any) => {
    console.log("Edit category:", category);
    // Implement edit functionality
  };

  const handleDeleteCategory = (category: any) => {
    console.log("Delete category:", category);
    // Implement delete functionality
  };

  const handleAddExpenseCategory = () => {
    console.log("Add expense category");
    // Implement add expense category functionality
  };

  const handleAddIncomeCategory = () => {
    console.log("Add income category");
    // Implement add income category functionality
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
    // Generate a random color for the new account
    const colors = [
      "#4CAF50",
      "#2196F3",
      "#9C27B0",
      "#FF9800",
      "#795548",
      "#607D8B",
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Create new account with random ID
    const newAccount = {
      id: Date.now().toString(),
      name: accountData.name,
      type: accountData.type,
      balance: accountData.balance,
      color: randomColor,
    };

    // Add to accounts array
    setAccounts([...accounts, newAccount]);
  };

  const handleEditAccount = (account: Account) => {
    console.log("Edit account:", account);
    // Implement edit functionality
    // For now, we'll just log the account to be edited
  };

  const handleDeleteAccount = (account: Account) => {
    // Remove the account from the accounts array
    setAccounts(accounts.filter((a) => a.id !== account.id));
  };

  return (
    <Card className="border-0 shadow-none bg-background">
      <CardHeader>
        <CardTitle>Settings & Configurations</CardTitle>
        <CardDescription>
          Manage your financial data settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardContent className="pt-6">
            {/* Main Navigation Buttons */}
            <div className="flex space-x-2 mb-6 overflow-x-auto">
              <Button
                variant={activeMainTab === "categories" ? "default" : "outline"}
                className={activeMainTab === "categories" ? "bg-primary" : ""}
                onClick={() => setActiveMainTab("categories")}
              >
                <Folder className="h-4 w-4 mr-2" /> Categories
              </Button>
              <Button
                variant={activeMainTab === "accounts" ? "default" : "outline"}
                className={activeMainTab === "accounts" ? "bg-primary" : ""}
                onClick={() => setActiveMainTab("accounts")}
              >
                <Users className="h-4 w-4 mr-2" /> Accounts
              </Button>
            </div>

            {/* Categories Tab Content */}
            {activeMainTab === "categories" && (
              <div>
                <div className="mb-6">
                  <h3 className="text-xl font-medium mb-4">
                    Category Management
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Manage your categories for expenses, income, goals,
                    investments, and accounts
                  </p>

                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <CategoryToggle
                      activeCategory={activeCategory}
                      onCategoryChange={setActiveCategory}
                    />

                    <div className="grid grid-cols-1 gap-6">
                      {activeCategory === "expense" && (
                        <div className="mt-4">
                          <CategoryListCard
                            title="Expense Categories"
                            description="Manage your expense categories"
                            items={categories["expense"]}
                            onAddItem={handleAddExpenseCategory}
                            onEditItem={handleEditCategory}
                            onDeleteItem={handleDeleteCategory}
                            colorField="color"
                            primaryField="name"
                            addButtonText="Add New Expense Category"
                          />
                        </div>
                      )}

                      {activeCategory === "income" && (
                        <div className="mt-4">
                          <CategoryListCard
                            title="Income Categories"
                            description="Manage your income categories"
                            items={categories["income"]}
                            onAddItem={handleAddIncomeCategory}
                            onEditItem={handleEditCategory}
                            onDeleteItem={handleDeleteCategory}
                            colorField="color"
                            primaryField="name"
                            secondaryField="budget"
                            addButtonText="Add New Income Category"
                          />
                        </div>
                      )}

                      {activeCategory === "goal" && (
                        <div className="mt-4">
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
                          />
                        </div>
                      )}

                      {activeCategory === "investment" && (
                        <div className="mt-4">
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
                          />
                        </div>
                      )}

                      {activeCategory === "account" && (
                        <div className="mt-4">
                          <CategoryListCard
                            title="Accounts"
                            description="Manage your accounts"
                            items={categories["account"]}
                            onAddItem={handleAddAccount}
                            onEditItem={handleEditCategory}
                            onDeleteItem={handleDeleteCategory}
                            colorField="color"
                            primaryField="name"
                            secondaryField="budget"
                            addButtonText="Add New Account"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Accounts Tab Content */}
            {activeMainTab === "accounts" && (
              <div>
                <div className="mb-6">
                  <h3 className="text-xl font-medium mb-4">
                    Account Management
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Manage your financial accounts, track balances, and organize
                    your money
                  </p>

                  <div className="border border-gray-200 rounded-lg p-6 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="md:col-span-1">
                        <AddAccountForm onAddAccount={handleAddAccount} />
                      </div>

                      <div className="md:col-span-2">
                        <AccountList
                          accounts={accounts}
                          onEditAccount={handleEditAccount}
                          onDeleteAccount={handleDeleteAccount}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default DatabaseTab;
