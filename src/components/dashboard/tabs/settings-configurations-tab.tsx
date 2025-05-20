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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Folder, Users, Settings, Upload, Download } from "lucide-react";
import CategoryToggle, { CategoryType } from "../category-toggle";
import CategoryListCard from "../category-list-card";
import AccountList, { Account } from "../account-list";
import AddAccountForm, { NewAccountData } from "../add-account-form";

const SettingsConfigurationsTab = () => {
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

  const handleAddCategory = () => {
    if (newCategoryName.trim() === "") return;
    // Logic to add a new category would go here
    setNewCategoryName("");
  };

  const handleExportToggle = (key: string) => {
    setSelectedExportItems({
      ...selectedExportItems,
      [key]: !selectedExportItems[key as keyof typeof selectedExportItems],
    });
  };

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
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardHeader>
        <CardTitle>Settings & Configurations</CardTitle>
        <CardDescription>
          Manage your financial data settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Main Navigation Tabs */}
        <div className="flex space-x-2 mb-6 overflow-x-auto">
          <Button
            variant={activeMainTab === "categories" ? "default" : "outline"}
            className={activeMainTab === "categories" ? "bg-[#0A3D62]" : ""}
            onClick={() => setActiveMainTab("categories")}
          >
            <Folder className="h-4 w-4 mr-2" /> Categories
          </Button>
          <Button
            variant={activeMainTab === "accounts" ? "default" : "outline"}
            className={activeMainTab === "accounts" ? "bg-[#0A3D62]" : ""}
            onClick={() => setActiveMainTab("accounts")}
          >
            <Users className="h-4 w-4 mr-2" /> Accounts
          </Button>
          <Button
            variant={
              activeMainTab === "default-settings" ? "default" : "outline"
            }
            className={
              activeMainTab === "default-settings" ? "bg-[#0A3D62]" : ""
            }
            onClick={() => setActiveMainTab("default-settings")}
          >
            <Settings className="h-4 w-4 mr-2" /> Default Settings
          </Button>
          <Button
            variant={activeMainTab === "import-export" ? "default" : "outline"}
            className={activeMainTab === "import-export" ? "bg-[#0A3D62]" : ""}
            onClick={() => setActiveMainTab("import-export")}
          >
            <Upload className="h-4 w-4 mr-2" /> Import & Export
          </Button>
        </div>

        {/* Categories Tab Content */}
        {activeMainTab === "categories" && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-medium mb-4">Category Management</h3>
              <p className="text-gray-500 mb-4">
                Manage your categories for expenses, income, goals, investments,
                and accounts
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
              <h3 className="text-xl font-medium mb-4">Account Management</h3>
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

        {/* Default Settings Tab Content */}
        {activeMainTab === "default-settings" && (
          <div>
            <Tabs defaultValue="transaction">
              <TabsList className="grid grid-cols-5 mb-6">
                <TabsTrigger value="transaction">
                  Transaction Settings
                </TabsTrigger>
                <TabsTrigger value="budget">Budget Settings</TabsTrigger>
                <TabsTrigger value="goals">Goals Settings</TabsTrigger>
                <TabsTrigger value="investment">
                  Investment Settings
                </TabsTrigger>
                <TabsTrigger value="currency">Currency & Format</TabsTrigger>
              </TabsList>

              {/* Transaction Settings */}
              <TabsContent value="transaction">
                <div className="space-y-6">
                  <h3 className="text-xl font-medium">
                    Transaction Default Settings
                  </h3>
                  <p className="text-gray-500">
                    Configure default settings for new transactions
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Default Account</Label>
                      <Select
                        value={defaultAccount}
                        onValueChange={setDefaultAccount}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BPI Savings">
                            BPI Savings
                          </SelectItem>
                          <SelectItem value="BDO Savings">
                            BDO Savings
                          </SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Transaction Type</Label>
                      <Select
                        value={defaultTransactionType}
                        onValueChange={setDefaultTransactionType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Expense">Expense</SelectItem>
                          <SelectItem value="Income">Income</SelectItem>
                          <SelectItem value="Transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default View Mode</Label>
                      <Select
                        value={defaultViewMode}
                        onValueChange={setDefaultViewMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select view mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="List View">List View</SelectItem>
                          <SelectItem value="Calendar View">
                            Calendar View
                          </SelectItem>
                          <SelectItem value="Category View">
                            Category View
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Date Range</Label>
                      <Select
                        value={defaultDateRange}
                        onValueChange={setDefaultDateRange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select date range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Month">Month</SelectItem>
                          <SelectItem value="Week">Week</SelectItem>
                          <SelectItem value="Year">Year</SelectItem>
                          <SelectItem value="All Time">All Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
                      Save Transaction Settings
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Budget Settings */}
              <TabsContent value="budget">
                <div className="space-y-6">
                  <h3 className="text-xl font-medium">
                    Budget Default Settings
                  </h3>
                  <p className="text-gray-500">
                    Configure default settings for budgets
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Default Budget Type</Label>
                      <Select
                        value={defaultBudgetType}
                        onValueChange={setDefaultBudgetType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select budget type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Weekly">Weekly</SelectItem>
                          <SelectItem value="Annual">Annual</SelectItem>
                          <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default View</Label>
                      <Select
                        value={defaultBudgetView}
                        onValueChange={setDefaultBudgetView}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select view" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Categories">Categories</SelectItem>
                          <SelectItem value="Progress">Progress</SelectItem>
                          <SelectItem value="Comparison">Comparison</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Budget Warning Threshold (%)</Label>
                      <Input
                        type="number"
                        value={budgetWarningThreshold}
                        onChange={(e) =>
                          setBudgetWarningThreshold(e.target.value)
                        }
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-8">
                      <Switch
                        checked={warnOnOverspend}
                        onCheckedChange={setWarnOnOverspend}
                        id="warn-on-overspend"
                      />
                      <Label htmlFor="warn-on-overspend">
                        Warn on overspend
                      </Label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
                      Save Budget Settings
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Goals Settings */}
              <TabsContent value="goals">
                <div className="space-y-6">
                  <h3 className="text-xl font-medium">
                    Goals Default Settings
                  </h3>
                  <p className="text-gray-500">
                    Configure default settings for financial goals
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Default Priority</Label>
                      <Select
                        value={defaultPriority}
                        onValueChange={setDefaultPriority}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Contribution Increment</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5">₱</span>
                        <Input
                          type="number"
                          className="pl-7"
                          value={defaultContributionIncrement}
                          onChange={(e) =>
                            setDefaultContributionIncrement(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={showCompletedGoals}
                        onCheckedChange={setShowCompletedGoals}
                        id="show-completed-goals"
                      />
                      <Label htmlFor="show-completed-goals">
                        Show completed goals by default
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={autoCalculateEndDate}
                        onCheckedChange={setAutoCalculateEndDate}
                        id="auto-calculate-end-date"
                      />
                      <Label htmlFor="auto-calculate-end-date">
                        Auto-calculate end date based on contribution
                      </Label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
                      Save Goals Settings
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Investment Settings */}
              <TabsContent value="investment">
                <div className="space-y-6">
                  <h3 className="text-xl font-medium">
                    Investment Default Settings
                  </h3>
                  <p className="text-gray-500">
                    Configure default settings for investments
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Default Risk Level</Label>
                      <Select
                        value={defaultRiskLevel}
                        onValueChange={setDefaultRiskLevel}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Return Rate Threshold (%)</Label>
                      <Input
                        type="number"
                        value={returnRateThreshold}
                        onChange={(e) => setReturnRateThreshold(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Default Sort By</Label>
                      <Select
                        value={defaultSortBy}
                        onValueChange={setDefaultSortBy}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sort field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Current Value">
                            Current Value
                          </SelectItem>
                          <SelectItem value="Return Rate">
                            Return Rate
                          </SelectItem>
                          <SelectItem value="Purchase Date">
                            Purchase Date
                          </SelectItem>
                          <SelectItem value="Name">Name</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Sort Direction</Label>
                      <Select
                        value={defaultSortDirection}
                        onValueChange={setDefaultSortDirection}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sort direction" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ascending">Ascending</SelectItem>
                          <SelectItem value="Descending">Descending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
                      Save Investment Settings
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Currency & Format Settings */}
              <TabsContent value="currency">
                <div className="space-y-6">
                  <h3 className="text-xl font-medium">
                    Currency & Format Settings
                  </h3>
                  <p className="text-gray-500">
                    Configure how currency and numbers are displayed
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Currency Symbol</Label>
                      <Input
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Currency Position</Label>
                      <Select
                        value={currencyPosition}
                        onValueChange={setCurrencyPosition}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Before Amount (₱100)">
                            Before Amount (₱100)
                          </SelectItem>
                          <SelectItem value="After Amount (100₱)">
                            After Amount (100₱)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Thousands Separator</Label>
                      <Select
                        value={thousandsSeparator}
                        onValueChange={setThousandsSeparator}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select separator" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Comma (,)">Comma (,)</SelectItem>
                          <SelectItem value="Period (.)">Period (.)</SelectItem>
                          <SelectItem value="Space ( )">Space ( )</SelectItem>
                          <SelectItem value="None">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Decimal Separator</Label>
                      <Select
                        value={decimalSeparator}
                        onValueChange={setDecimalSeparator}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select separator" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Period (.)">Period (.)</SelectItem>
                          <SelectItem value="Comma (,)">Comma (,)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Decimal Places</Label>
                      <Select
                        value={decimalPlaces}
                        onValueChange={setDecimalPlaces}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select decimal places" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Preview</h4>
                    <div className="p-4 bg-gray-100 rounded-md text-center text-xl">
                      ₱1,234.55
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
                      Save Currency Settings
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Import & Export Tab Content */}
        {activeMainTab === "import-export" && (
          <div>
            <Tabs defaultValue="export">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="export" className="flex-1">
                  Export Data
                </TabsTrigger>
                <TabsTrigger value="import" className="flex-1">
                  Import Data
                </TabsTrigger>
              </TabsList>

              {/* Export Data Tab */}
              <TabsContent value="export">
                <div className="space-y-6">
                  <h3 className="text-xl font-medium">
                    Export Your Financial Data
                  </h3>
                  <p className="text-gray-500">
                    Select the data you want to export. The file will be
                    downloaded in JSON format and can be used for backup or to
                    import into another account
                  </p>

                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <p className="text-yellow-800">
                      Your export file will contain sensitive financial
                      information. Store it securely and do not share it with
                      others.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium mb-2">Select data to export:</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 border rounded-md">
                        <div className="flex items-center">
                          <div className="mr-3 text-[#0A3D62]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">Transactions</p>
                            <p className="text-sm text-gray-500">77 records</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedExportItems.transactions}
                          onCheckedChange={() =>
                            handleExportToggle("transactions")
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-md">
                        <div className="flex items-center">
                          <div className="mr-3 text-[#0A3D62]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="2"
                                y="7"
                                width="20"
                                height="14"
                                rx="2"
                                ry="2"
                              ></rect>
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">Budgets</p>
                            <p className="text-sm text-gray-500">8 records</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedExportItems.budgets}
                          onCheckedChange={() => handleExportToggle("budgets")}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-md">
                        <div className="flex items-center">
                          <div className="mr-3 text-[#0A3D62]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10"></circle>
                              <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                              <line x1="9" y1="9" x2="9.01" y2="9"></line>
                              <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">Goals</p>
                            <p className="text-sm text-gray-500">6 records</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedExportItems.goals}
                          onCheckedChange={() => handleExportToggle("goals")}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-md">
                        <div className="flex items-center">
                          <div className="mr-3 text-[#0A3D62]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">Investments</p>
                            <p className="text-sm text-gray-500">4 records</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedExportItems.investments}
                          onCheckedChange={() =>
                            handleExportToggle("investments")
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-md">
                        <div className="flex items-center">
                          <div className="mr-3 text-[#0A3D62]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">Insights</p>
                            <p className="text-sm text-gray-500">12 records</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedExportItems.insights}
                          onCheckedChange={() => handleExportToggle("insights")}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-md">
                        <div className="flex items-center">
                          <div className="mr-3 text-[#0A3D62]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="3"
                                y="5"
                                width="18"
                                height="14"
                                rx="2"
                              ></rect>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">Accounts</p>
                            <p className="text-sm text-gray-500">5 records</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedExportItems.accounts}
                          onCheckedChange={() => handleExportToggle("accounts")}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-md">
                        <div className="flex items-center">
                          <div className="mr-3 text-[#0A3D62]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="3"></circle>
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">Settings</p>
                            <p className="text-sm text-gray-500">
                              All settings
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedExportItems.settings}
                          onCheckedChange={() => handleExportToggle("settings")}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
                      <Download className="h-4 w-4 mr-2" /> Export Data
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Import Data Tab */}
              <TabsContent value="import">
                <div className="space-y-6">
                  <h3 className="text-xl font-medium">Import Financial Data</h3>
                  <p className="text-gray-500">
                    Import data from a previously exported file. This will add
                    to your existing data.
                  </p>

                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <p className="text-yellow-800">
                      Importing data will not delete your existing data, but may
                      cause duplicates if you import the same data multiple
                      times.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Import Format</Label>
                      <Select
                        value={importFormat}
                        onValueChange={setImportFormat}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="JSON (Recommended)">
                            JSON (Recommended)
                          </SelectItem>
                          <SelectItem value="CSV">CSV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Select File</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                        <p className="text-gray-500">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          JSON files only
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
                      <Upload className="h-4 w-4 mr-2" /> Start Import
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsConfigurationsTab;
