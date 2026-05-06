import React, { useState, useEffect } from "react";
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Folder, Users, Settings, Upload, Download, Pencil, Plus, CreditCard, X, Loader2, AlertCircle, Copy, Check, Zap, Play, RefreshCw } from "lucide-react";
import CategoryToggle, { CategoryToggleType } from "../category-toggle";
import CategoryListCard from "../category-list-card";
import AccountList from "../account-list";
import AddAccountForm, { NewAccountData } from "../add-account-form";
import CategoryFormDialog from "../category-form-dialog";
import DeleteCategoryDialog from "../delete-category-dialog";
import { ImportWizard } from "@/components/import/import-wizard";
import { ImportResults } from "@/components/import/import-results";
import { useTransactionCategories } from "@/hooks/async/useTransactionCategories";
import { useAccounts } from "@/hooks/async/useAccounts";
import { useImports } from "@/hooks/async/useImport";
import { useCurrentSubscription, useCancelSubscription, useSimulateCyclePayment, useForceAttemptCycle, useUpdateSubscription, useSubscriptionPlans } from "@/hooks/async/useSubscriptions";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { getActionCableClient, ActionCableMessage } from "@/lib/actionCable";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getColor, shouldShowV2Features, formatCurrency } from "@/lib/utils";
import { shouldShowSimulatePaymentButton } from "@/lib/capacitor";
import { TransactionCategory } from "@/types/transactionCategoryTypes";
import { Account } from "@/types/accountTypes";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import EditButton from "@/components/ui/edit-button";

// Define CategoryItem interface to match CategoryListCard expectations
interface CategoryItem {
  id: string;
  name: string;
  color?: string;
  amount?: number;
  budget?: number;
  [key: string]: any; // For any additional properties
}

interface SpaceSettingsTabProps {
  initialTab?: "categories" | "accounts" | "import" | "subscriptions";
  hideTabs?: boolean;
}

const   SpaceSettingsTab = ({ initialTab = "categories", hideTabs = false }: SpaceSettingsTabProps) => {
  const [activeMainTab, setActiveMainTab] = useState(initialTab);
  const [activeSubTab, setActiveSubTab] = useState("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryToggleType>("expense");
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const showV2Features = shouldShowV2Features();

  // Get auth API and space context for Action Cable
  const { api, getToken } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const queryClient = useQueryClient();

  // Fetch subscription data
  const { subscriptions, subscription, isLoading: isLoadingSubscription, refetch: refetchSubscription } = useCurrentSubscription();
  const { cancelSubscription, isCancelling } = useCancelSubscription();
  const { simulateCyclePayment, isSimulating } = useSimulateCyclePayment();
  const { forceAttemptCycle, isForcing } = useForceAttemptCycle();
  const { updateSubscription, isUpdating } = useUpdateSubscription();
  const { plans, isLoading: isLoadingPlans } = useSubscriptionPlans();
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);
  const [showSimulateDialog, setShowSimulateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [billingCycleId, setBillingCycleId] = useState("");
  const [amount, setAmount] = useState("");
  const [copiedCycleId, setCopiedCycleId] = useState<string | null>(null);

  // Check if we're in development or staging
  const isDevOrStaging =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && (window.location.hostname.includes("staging") || window.location.hostname.includes("localhost")));

  const activeSubscription = subscriptions.find((sub) => sub.status === "active");
  const requiresActionSubscriptions = subscriptions.filter((sub) => sub.status === "requires_action");
  const pendingSubscriptions = subscriptions.filter((sub) => sub.status === "pending");
  const cancelledSubscriptions = subscriptions.filter((sub) => sub.status === "inactive");
  const hasActivePendingOrRequiresAction = subscriptions.some(
    (sub) => sub.status === "active" || sub.status === "pending" || sub.status === "requires_action"
  );
  const shouldShowCreateButton = !hasActivePendingOrRequiresAction;

  // Set up Action Cable subscription for real-time updates
  useEffect(() => {
    if (!currentSpace?.id) return;

    const channel = `subscriptions:${currentSpace.id}`;
    const client = getActionCableClient(async () => {
      try {
        return await getToken();
      } catch (error) {
        console.error("Failed to get token for Action Cable:", error);
        return undefined;
      }
    });

    const handleSubscriptionUpdate = (message: ActionCableMessage) => {
      if (message.type === "subscription_updated") {
        console.log("Subscription updated via Action Cable:", message);
        toast.success(message.message || "Subscription updated successfully");
        // Invalidate queries to refetch latest data
        queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
        queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
        queryClient.invalidateQueries({ queryKey: ["ai", "usage"] });
      }
    };

    // Connect and subscribe
    client.connect();
    client.subscribe(channel, handleSubscriptionUpdate);

    // Cleanup on unmount
    return () => {
      client.unsubscribe(channel);
    };
  }, [currentSpace?.id, getToken, queryClient]);

  const handleCancelSubscription = async () => {
    if (!showCancelDialog) return;

    try {
      await cancelSubscription(showCancelDialog);
      toast.success("Subscription cancelled successfully");
      setShowCancelDialog(null);
      await refetchSubscription();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel subscription");
    }
  };

  const handleUpdateSubscription = async () => {
    if (!showUpdateDialog || !selectedPlanId) return;

    try {
      const result = await updateSubscription({
        subscriptionId: showUpdateDialog,
        data: { subscriptionPlanId: selectedPlanId },
      });

      toast.success("Subscription updated successfully");
      setShowUpdateDialog(null);
      setSelectedPlanId("");

      // If there's a payment session URL (for upgrades), open it in a new tab
      if (result.paymentSessionUrl) {
        window.open(result.paymentSessionUrl, "_blank", "noopener,noreferrer");
        await refetchSubscription();
      } else {
        await refetchSubscription();
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.details?.subscription || 
                          error?.response?.data?.message || 
                          error?.message || 
                          "Failed to update subscription";
      toast.error(errorMessage);
    }
  };

  const handleCopyCycleId = async (cycleId: string) => {
    try {
      if (typeof window !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(cycleId);
        setCopiedCycleId(cycleId);
        toast.success("Cycle ID copied to clipboard!");
        setTimeout(() => setCopiedCycleId(null), 2000);
      }
    } catch (err) {
      toast.error("Failed to copy cycle ID");
    }
  };

  const handleSimulateCyclePayment = async () => {
    if (!billingCycleId.trim()) {
      toast.error("Please enter a billing cycle ID");
      return;
    }

    if (!amount.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    try {
      await simulateCyclePayment({ 
        billingCycleId: billingCycleId.trim(),
        amount: parseFloat(amount)
      });
      toast.success("Cycle payment simulated successfully");
      setShowSimulateDialog(false);
      setBillingCycleId("");
      setAmount("");
      await refetchSubscription();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to simulate cycle payment");
    }
  };

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

  // Fetch imports with pagination
  const { imports, isLoading: importsLoading, pagination, refetch: refetchImports } = useImports(undefined, undefined, currentPage, 10);

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
        <EditButton onClick={() => {}} />
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
              <p className="text-red-900 mb-4">Failed to load categories. Please try again.</p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get the title based on active tab
  const getHeaderTitle = () => {
    switch (activeMainTab) {
      case "categories":
        return "Categories";
      case "accounts":
        return "Accounts";
      case "import":
        return "Import";
      case "subscriptions":
        return "Subscriptions";
      default:
        return "Settings & Configurations";
    }
  };

  const getHeaderDescription = () => {
    switch (activeMainTab) {
      case "categories":
        return "Manage your categories for expenses, income, goals, investments, and accounts";
      case "accounts":
        return "Manage your financial accounts, track balances, and organize your money";
      case "import":
        return "Import your transaction data from Excel files or view your import history";
      case "subscriptions":
        return "Manage your subscription plan and payment methods";
      default:
        return "Manage your financial data settings and preferences";
    }
  };

  return (
    <>
    <Card className="border-0 shadow-none bg-background py-0 md:py-4">
      <CardHeader className="px-0 hidden md:block">
        <CardTitle>{getHeaderTitle()}</CardTitle>
        <CardDescription>
          {getHeaderDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {/* Main Navigation Buttons */}
        {!hideTabs && (
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
            <Button
              variant={activeMainTab === "import" ? "default" : "outline"}
              className={activeMainTab === "import" ? "bg-primary" : "bg-white"}
              onClick={() => setActiveMainTab("import")}
            >
              <Download className="h-4 w-4 mr-2" /> Import
            </Button>
            <Button
              variant={activeMainTab === "subscriptions" ? "default" : "outline"}
              className={activeMainTab === "subscriptions" ? "bg-primary" : "bg-white"}
              onClick={() => setActiveMainTab("subscriptions")}
            >
              <CreditCard className="h-4 w-4 mr-2" /> Subscriptions
            </Button>
          </div>
        )}

        {/* Categories Tab Content */}
        {activeMainTab === "categories" && (
          <>
            <h3 className="hidden md:block text-2xl font-bold mb-4 text-primary">
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
            <h3 className="hidden md:block text-2xl font-bold mb-4 text-primary">
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
                  <p className="bg-red-800 text-center py-4">
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

        {/* Import & Export Tab Content */}
        {activeMainTab === "import" && (
          <div className="space-y-6">
            <div>
              <h3 className="hidden md:block text-2xl font-bold mb-4 text-primary">
                Import & Export
              </h3>
              <p className="text-gray-500 mb-4">
                Import your transaction data from Excel files or view your import history
              </p>
            </div>

            {showImportWizard ? (
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportWizard(false);
                    setSelectedImportId(null);
                  }}
                >
                  ← Back to Imports
                </Button>
                <ImportWizard
                  context="settings"
                  onImportComplete={(importId) => {
                    setShowImportWizard(false);
                    setSelectedImportId(importId);
                    refetchImports();
                  }}
                />
              </div>
            ) : selectedImportId ? (
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedImportId(null);
                    refetchImports();
                  }}
                >
                  ← Back to Imports
                </Button>
                <ImportResults
                  importId={selectedImportId}
                  onRevert={() => {
                    setSelectedImportId(null);
                    refetchImports();
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Import History</h4>
                  <Button
                    onClick={() => setShowImportWizard(true)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    New Import
                  </Button>
                </div>

                {importsLoading ? (
                  <div className="text-center py-8">
                    <LoadingSpinner size="medium" />
                    <p className="text-sm text-muted-foreground mt-2">Loading imports...</p>
                  </div>
                ) : imports.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-4">
                      No imports yet. Start by creating a new import.
                    </p>
                    <Button
                      onClick={() => setShowImportWizard(true)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Start Import
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {imports.map((importItem: any) => (
                        <div
                          key={importItem.id}
                          className="border rounded-lg p-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedImportId(importItem.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-medium text-primary">
                                  Import #{importItem.id.slice(0, 8)}
                                </div>
                                <div className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  importItem.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  importItem.status === 'failed' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {importItem.status}
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(importItem.createdAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {importItem.totalRowsInserted} imported{importItem.totalRowsFailed > 0 ? `, ${importItem.totalRowsFailed} failed` : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination Controls */}
                    {pagination && pagination.totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          Showing page {pagination.currentPage || currentPage} of {pagination.totalPages || 1} ({pagination.totalCount || 0} total imports)
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={(pagination.currentPage || currentPage) === 1}
                            className="hidden sm:flex"
                          >
                            First
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={(pagination.currentPage || currentPage) === 1}
                          >
                            Previous
                          </Button>
                          
                          <div className="flex items-center gap-1 mx-2">
                            {(() => {
                              const totalPages = pagination.totalPages || 1;
                              const current = pagination.currentPage || currentPage;
                              const pages = [];
                              
                              if (totalPages < 1) return null;
                              
                              if (current > 3) {
                                pages.push(
                                  <Button
                                    key={1}
                                    variant={1 === current ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(1)}
                                    className="w-8 h-8 p-0"
                                  >
                                    1
                                  </Button>
                                );
                                
                                if (current > 4) {
                                  pages.push(
                                    <span key="ellipsis1" className="px-2 text-gray-500">
                                      ...
                                    </span>
                                  );
                                }
                              }
                              
                              const start = Math.max(1, current - 1);
                              const end = Math.min(totalPages, current + 1);
                              
                              for (let i = start; i <= end; i++) {
                                pages.push(
                                  <Button
                                    key={i}
                                    variant={i === current ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(i)}
                                    className="w-8 h-8 p-0"
                                  >
                                    {i}
                                  </Button>
                                );
                              }
                              
                              if (current < totalPages - 2) {
                                if (current < totalPages - 3) {
                                  pages.push(
                                    <span key="ellipsis2" className="px-2 text-gray-500">
                                      ...
                                    </span>
                                  );
                                }
                                pages.push(
                                  <Button
                                    key={totalPages}
                                    variant={totalPages === current ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(totalPages)}
                                    className="w-8 h-8 p-0"
                                  >
                                    {totalPages}
                                  </Button>
                                );
                              }
                              
                              return pages;
                            })()}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages || 1, prev + 1))}
                            disabled={(pagination.currentPage || currentPage) >= (pagination.totalPages || 1)}
                          >
                            Next
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(pagination.totalPages || 1)}
                            disabled={(pagination.currentPage || currentPage) >= (pagination.totalPages || 1)}
                            className="hidden sm:flex"
                          >
                            Last
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Subscriptions Tab Content */}
        {activeMainTab === "subscriptions" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="hidden md:block text-2xl font-bold mb-4 text-primary">
                  Subscription Management
                </h3>
                <p className="text-gray-500 mb-4">
                  Manage your subscription plan and payment methods
                </p>
              </div>
              {shouldShowSimulatePaymentButton() && (
                <Button
                  variant="outline"
                  onClick={() => setShowSimulateDialog(true)}
                  className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 w-full sm:w-auto flex items-center justify-center min-h-[40px]"
                >
                  <Play className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Simulate Payment</span>
                  <span className="sm:hidden">Simulate</span>
                </Button>
              )}
            </div>

            {isLoadingSubscription ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="medium" />
              </div>
            ) : subscriptions.length > 0 ? (
              <div className="space-y-4">
                {shouldShowCreateButton && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Create New Subscription</CardTitle>
                      <CardDescription>
                        Create a new subscription to unlock premium features
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href="/dashboard/subscriptions/create">
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Subscribe
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
                {activeSubscription && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Current Subscription</CardTitle>
                      <CardDescription>Your active subscription plan</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-lg font-semibold">{activeSubscription.subscriptionPlan.name}</h4>
                          <p className="text-gray-600">{activeSubscription.subscriptionPlan.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Price</p>
                            <p className="text-lg font-semibold">
                              {formatCurrency(
                                activeSubscription.subscriptionPlan.priceCents / 100,
                                activeSubscription.subscriptionPlan.priceCurrency
                              )}{" "}
                              / {activeSubscription.subscriptionPlan.interval}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Token Limit</p>
                            <p className="text-lg font-semibold">{activeSubscription.subscriptionPlan.tokenLimit}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className="text-lg font-semibold capitalize">{activeSubscription.status}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Current Cycle</p>
                            <p className="text-lg font-semibold">{activeSubscription.currentCycleCount}</p>
                          </div>
                        </div>
                        {activeSubscription.billingCycles && activeSubscription.billingCycles.length > 0 && (
                          <div className="pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-3">Billing Cycles</h4>
                            <div className="border rounded-lg overflow-hidden">
                              <div className="max-h-[180px] overflow-y-auto">
                                <Table>
                                <TableHeader className="bg-gray-50">
                                  <TableRow className="hover:bg-gray-50">
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Cycle</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Status</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Scheduled Payment</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Start Date</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">End Date</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Tokens Allocated</TableHead>
                                    {activeSubscription.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) && (
                                      <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Action</TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {activeSubscription.billingCycles
                                    ?.sort((a, b) => (b.cycleNumber || 0) - (a.cycleNumber || 0))
                                    .map((cycle) => (
                                    <TableRow key={cycle.id} className="hover:bg-gray-50">
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <span>{cycle.cycleNumber}</span>
                                          <button
                                            onClick={() => handleCopyCycleId(cycle.id)}
                                            className="text-gray-500 hover:text-gray-700 transition-colors"
                                            title={copiedCycleId === cycle.id ? "Copied!" : "Copy billing cycle ID"}
                                          >
                                            {copiedCycleId === cycle.id ? (
                                              <Check className="h-3 w-3 text-green-600" />
                                            ) : (
                                              <Copy className="h-3 w-3" />
                                            )}
                                          </button>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                        <span className={`px-2 py-1 rounded capitalize ${
                                          cycle.status === "paid" ? "bg-green-100 text-green-800" :
                                          cycle.status === "failed" ? "bg-red-100 text-red-800" :
                                          "bg-yellow-100 text-yellow-800"
                                        }`}>
                                          {cycle.status}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.scheduledTimestamp ? new Date(cycle.scheduledTimestamp).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.startedAt ? new Date(cycle.startedAt).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.endsAt ? new Date(cycle.endsAt).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.tokensAllocated ? cycle.tokensAllocated.toLocaleString() : "-"}
                                      </TableCell>
                                      {activeSubscription.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) && (
                                        <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            {cycle.status === "failed" && cycle.actionUrl && activeSubscription?.status !== "inactive" ? (
                                              <Button
                                                onClick={() => {
                                                  if (cycle.actionUrl) {
                                                    window.location.href = cycle.actionUrl;
                                                  }
                                                }}
                                                className="text-xs px-2 py-1 h-auto rounded-sm"
                                                size="sm"
                                              >
                                                <CreditCard className="h-3 w-3" />
                                                Pay
                                              </Button>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                            {isDevOrStaging && cycle.xenditCycleId && (
                                              <Button
                                                onClick={async () => {
                                                  try {
                                                    await forceAttemptCycle({
                                                      billingCycleId: cycle.id,
                                                    });
                                                    toast.success("Force attempt initiated", {
                                                      description: "The cycle force attempt has been initiated successfully.",
                                                    });
                                                    refetchSubscription();
                                                  } catch (error: any) {
                                                    toast.error("Force attempt failed", {
                                                      description: error?.response?.data?.error?.message || error.message || "Failed to force attempt cycle",
                                                    });
                                                  }
                                                }}
                                                variant="outline"
                                                className="text-xs px-2 py-1 h-auto rounded-sm"
                                                size="sm"
                                                disabled={isForcing}
                                              >
                                                {isForcing ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <RefreshCw className="h-3 w-3" />
                                                )}
                                                Force
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="pt-4 border-t flex flex-col sm:flex-row gap-2">
                          {activeSubscription.canChangePlan !== false && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowUpdateDialog(activeSubscription.id);
                                setSelectedPlanId("");
                              }}
                              disabled={isUpdating || isLoadingPlans}
                            >
                              {isUpdating ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Change Plan
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            onClick={() => setShowCancelDialog(activeSubscription.id)}
                            disabled={isCancelling}
                          >
                            {isCancelling ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Cancelling...
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-2" />
                                Cancel Subscription
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {requiresActionSubscriptions.map((sub) => (
                  <Card key={sub.id}>
                    <CardHeader>
                      <CardTitle>Subscription Requires Action</CardTitle>
                      <CardDescription>
                        Your subscription requires action to complete setup. Please complete the payment authorization to activate your subscription.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-lg font-semibold">{sub.subscriptionPlan.name}</h4>
                          <p className="text-gray-600">{sub.subscriptionPlan.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Price</p>
                            <p className="text-lg font-semibold">
                              {formatCurrency(
                                sub.subscriptionPlan.priceCents / 100,
                                sub.subscriptionPlan.priceCurrency
                              )}{" "}
                              / {sub.subscriptionPlan.interval}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Token Limit</p>
                            <p className="text-lg font-semibold">{sub.subscriptionPlan.tokenLimit}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className="text-lg font-semibold capitalize">{sub.status}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Current Cycle</p>
                            <p className="text-lg font-semibold">{sub.currentCycleCount}</p>
                          </div>
                        </div>
                        {sub.billingCycles && sub.billingCycles.length > 0 && (
                          <div className="pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-3">Billing Cycles</h4>
                            <div className="border rounded-lg overflow-hidden">
                              <div className="max-h-[180px] overflow-y-auto">
                                <Table>
                                <TableHeader className="bg-gray-50">
                                  <TableRow className="hover:bg-gray-50">
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Cycle</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Status</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Scheduled Payment</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Start Date</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">End Date</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Tokens Allocated</TableHead>
                                    {sub.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) && (
                                      <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Action</TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sub.billingCycles
                                    ?.sort((a, b) => (b.cycleNumber || 0) - (a.cycleNumber || 0))
                                    .map((cycle) => (
                                    <TableRow key={cycle.id} className="hover:bg-gray-50">
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <span>{cycle.cycleNumber}</span>
                                          <button
                                            onClick={() => handleCopyCycleId(cycle.id)}
                                            className="text-gray-500 hover:text-gray-700 transition-colors"
                                            title={copiedCycleId === cycle.id ? "Copied!" : "Copy billing cycle ID"}
                                          >
                                            {copiedCycleId === cycle.id ? (
                                              <Check className="h-3 w-3 text-green-600" />
                                            ) : (
                                              <Copy className="h-3 w-3" />
                                            )}
                                          </button>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                        <span className={`px-2 py-1 rounded capitalize ${
                                          cycle.status === "paid" ? "bg-green-100 text-green-800" :
                                          cycle.status === "failed" ? "bg-red-100 text-red-800" :
                                          "bg-yellow-100 text-yellow-800"
                                        }`}>
                                          {cycle.status}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.scheduledTimestamp ? new Date(cycle.scheduledTimestamp).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.startedAt ? new Date(cycle.startedAt).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.endsAt ? new Date(cycle.endsAt).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.tokensAllocated ? cycle.tokensAllocated.toLocaleString() : "-"}
                                      </TableCell>
                                      {sub.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) && (
                                        <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            {cycle.status === "failed" && cycle.actionUrl && sub.status !== "inactive" ? (
                                              <Button
                                                onClick={() => {
                                                  if (cycle.actionUrl) {
                                                    window.location.href = cycle.actionUrl;
                                                  }
                                                }}
                                                className="text-xs px-2 py-1 h-auto rounded-sm"
                                                size="sm"
                                              >
                                                <CreditCard className="h-3 w-3" />
                                                Pay
                                              </Button>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                            {isDevOrStaging && cycle.xenditCycleId && (
                                              <Button
                                                onClick={async () => {
                                                  try {
                                                    await forceAttemptCycle({
                                                      billingCycleId: cycle.id,
                                                    });
                                                    toast.success("Force attempt initiated", {
                                                      description: "The cycle force attempt has been initiated successfully.",
                                                    });
                                                    refetchSubscription();
                                                  } catch (error: any) {
                                                    toast.error("Force attempt failed", {
                                                      description: error?.response?.data?.error?.message || error.message || "Failed to force attempt cycle",
                                                    });
                                                  }
                                                }}
                                                variant="outline"
                                                className="text-xs px-2 py-1 h-auto rounded-sm"
                                                size="sm"
                                                disabled={isForcing}
                                              >
                                                {isForcing ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <RefreshCw className="h-3 w-3" />
                                                )}
                                                Force
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              </div>
                            </div>
                          </div>
                        )}
                        {sub.actionUrl && (
                          <div className="pt-4 border-t">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                                    Action Required
                                  </h4>
                                  <p className="text-sm text-blue-800 mb-3">
                                    Please complete the payment authorization to activate your subscription.
                                  </p>
                                  <Button
                                    onClick={() => {
                                      if (sub.actionUrl) {
                                        window.location.href = sub.actionUrl;
                                      }
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    size="sm"
                                  >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Complete Authorization
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="pt-4 border-t">
                          <Button
                            variant="destructive"
                            onClick={() => setShowCancelDialog(sub.id)}
                            disabled={isCancelling}
                          >
                            {isCancelling ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Cancelling...
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-2" />
                                Cancel Subscription
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {pendingSubscriptions.map((sub) => (
                  <Card key={sub.id}>
                    <CardHeader>
                      <CardTitle>Pending Subscription</CardTitle>
                      <CardDescription>
                        Your subscription is being set up. It will be activated shortly.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-lg font-semibold">{sub.subscriptionPlan.name}</h4>
                          <p className="text-gray-600">{sub.subscriptionPlan.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Price</p>
                            <p className="text-lg font-semibold">
                              {formatCurrency(
                                sub.subscriptionPlan.priceCents / 100,
                                sub.subscriptionPlan.priceCurrency
                              )}{" "}
                              / {sub.subscriptionPlan.interval}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Token Limit</p>
                            <p className="text-lg font-semibold">{sub.subscriptionPlan.tokenLimit}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className="text-lg font-semibold capitalize">{sub.status}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Current Cycle</p>
                            <p className="text-lg font-semibold">{sub.currentCycleCount}</p>
                          </div>
                        </div>
                        {sub.billingCycles && sub.billingCycles.length > 0 && (
                          <div className="pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-3">Billing Cycles</h4>
                            <div className="border rounded-lg overflow-hidden">
                              <div className="max-h-[180px] overflow-y-auto">
                                <Table>
                                <TableHeader className="bg-gray-50">
                                  <TableRow className="hover:bg-gray-50">
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Cycle</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Status</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Scheduled Payment</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Start Date</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">End Date</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Tokens Allocated</TableHead>
                                    {sub.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) && (
                                      <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Action</TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sub.billingCycles
                                    ?.sort((a, b) => (b.cycleNumber || 0) - (a.cycleNumber || 0))
                                    .map((cycle) => (
                                    <TableRow key={cycle.id} className="hover:bg-gray-50">
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <span>{cycle.cycleNumber}</span>
                                          <button
                                            onClick={() => handleCopyCycleId(cycle.id)}
                                            className="text-gray-500 hover:text-gray-700 transition-colors"
                                            title={copiedCycleId === cycle.id ? "Copied!" : "Copy billing cycle ID"}
                                          >
                                            {copiedCycleId === cycle.id ? (
                                              <Check className="h-3 w-3 text-green-600" />
                                            ) : (
                                              <Copy className="h-3 w-3" />
                                            )}
                                          </button>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                        <span className={`px-2 py-1 rounded capitalize ${
                                          cycle.status === "paid" ? "bg-green-100 text-green-800" :
                                          cycle.status === "failed" ? "bg-red-100 text-red-800" :
                                          "bg-yellow-100 text-yellow-800"
                                        }`}>
                                          {cycle.status}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.scheduledTimestamp ? new Date(cycle.scheduledTimestamp).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.startedAt ? new Date(cycle.startedAt).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.endsAt ? new Date(cycle.endsAt).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.tokensAllocated ? cycle.tokensAllocated.toLocaleString() : "-"}
                                      </TableCell>
                                      {sub.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) && (
                                        <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            {cycle.status === "failed" && cycle.actionUrl && sub.status !== "inactive" ? (
                                              <Button
                                                onClick={() => {
                                                  if (cycle.actionUrl) {
                                                    window.location.href = cycle.actionUrl;
                                                  }
                                                }}
                                                className="text-xs px-2 py-1 h-auto rounded-sm"
                                                size="sm"
                                              >
                                                <CreditCard className="h-3 w-3" />
                                                Pay
                                              </Button>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                            {isDevOrStaging && cycle.xenditCycleId && (
                                              <Button
                                                onClick={async () => {
                                                  try {
                                                    await forceAttemptCycle({
                                                      billingCycleId: cycle.id,
                                                    });
                                                    toast.success("Force attempt initiated", {
                                                      description: "The cycle force attempt has been initiated successfully.",
                                                    });
                                                    refetchSubscription();
                                                  } catch (error: any) {
                                                    toast.error("Force attempt failed", {
                                                      description: error?.response?.data?.error?.message || error.message || "Failed to force attempt cycle",
                                                    });
                                                  }
                                                }}
                                                variant="outline"
                                                className="text-xs px-2 py-1 h-auto rounded-sm"
                                                size="sm"
                                                disabled={isForcing}
                                              >
                                                {isForcing ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <RefreshCw className="h-3 w-3" />
                                                )}
                                                Force
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {cancelledSubscriptions.map((sub) => (
                  <Card key={sub.id}>
                    <CardHeader>
                      <CardTitle>Cancelled Subscription</CardTitle>
                      <CardDescription>
                        {sub.gracePeriodEndsAt
                          ? `Your subscription has been cancelled. You will continue to have access until ${new Date(sub.gracePeriodEndsAt).toLocaleDateString()}.`
                          : "Your subscription has been cancelled."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-lg font-semibold">{sub.subscriptionPlan.name}</h4>
                          <p className="text-gray-600">{sub.subscriptionPlan.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Price</p>
                            <p className="text-lg font-semibold">
                              {formatCurrency(
                                sub.subscriptionPlan.priceCents / 100,
                                sub.subscriptionPlan.priceCurrency
                              )}{" "}
                              / {sub.subscriptionPlan.interval}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Token Limit</p>
                            <p className="text-lg font-semibold">{sub.subscriptionPlan.tokenLimit}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className="text-lg font-semibold capitalize">{sub.status}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Current Cycle</p>
                            <p className="text-lg font-semibold">{sub.currentCycleCount}</p>
                          </div>
                          {sub.gracePeriodEndsAt && (
                            <div className="col-span-2">
                              <p className="text-sm text-gray-500">Subscription Ends</p>
                              <p className="text-lg font-semibold text-red-900">
                                {new Date(sub.gracePeriodEndsAt).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                        {sub.billingCycles && sub.billingCycles.length > 0 && (
                          <div className="pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-3">Billing Cycles</h4>
                            <div className="border rounded-lg overflow-hidden">
                              <div className="max-h-[180px] overflow-y-auto">
                                <Table>
                                <TableHeader className="bg-gray-50">
                                  <TableRow className="hover:bg-gray-50">
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Cycle</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Status</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Scheduled Payment</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Start Date</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">End Date</TableHead>
                                    <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Tokens Allocated</TableHead>
                                    {sub.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) && (
                                      <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Action</TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sub.billingCycles
                                    ?.sort((a, b) => (b.cycleNumber || 0) - (a.cycleNumber || 0))
                                    .map((cycle) => (
                                    <TableRow key={cycle.id} className="hover:bg-gray-50">
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <span>{cycle.cycleNumber}</span>
                                          <button
                                            onClick={() => handleCopyCycleId(cycle.id)}
                                            className="text-gray-500 hover:text-gray-700 transition-colors"
                                            title={copiedCycleId === cycle.id ? "Copied!" : "Copy billing cycle ID"}
                                          >
                                            {copiedCycleId === cycle.id ? (
                                              <Check className="h-3 w-3 text-green-600" />
                                            ) : (
                                              <Copy className="h-3 w-3" />
                                            )}
                                          </button>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                        <span className={`px-2 py-1 rounded capitalize ${
                                          cycle.status === "paid" ? "bg-green-100 text-green-800" :
                                          cycle.status === "failed" ? "bg-red-100 text-red-800" :
                                          "bg-yellow-100 text-yellow-800"
                                        }`}>
                                          {cycle.status}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.scheduledTimestamp ? new Date(cycle.scheduledTimestamp).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.startedAt ? new Date(cycle.startedAt).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.endsAt ? new Date(cycle.endsAt).toLocaleDateString() : "-"}
                                      </TableCell>
                                      <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                        {cycle.tokensAllocated ? cycle.tokensAllocated.toLocaleString() : "-"}
                                      </TableCell>
                                      {sub.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) && (
                                        <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            {cycle.status === "failed" && cycle.actionUrl && sub.status !== "inactive" ? (
                                              <Button
                                                onClick={() => {
                                                  if (cycle.actionUrl) {
                                                    window.location.href = cycle.actionUrl;
                                                  }
                                                }}
                                                className="text-xs px-2 py-1 h-auto rounded-sm"
                                                size="sm"
                                              >
                                                <CreditCard className="h-3 w-3" />
                                                Pay
                                              </Button>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                            {isDevOrStaging && cycle.xenditCycleId && (
                                              <Button
                                                onClick={async () => {
                                                  try {
                                                    await forceAttemptCycle({
                                                      billingCycleId: cycle.id,
                                                    });
                                                    toast.success("Force attempt initiated", {
                                                      description: "The cycle force attempt has been initiated successfully.",
                                                    });
                                                    refetchSubscription();
                                                  } catch (error: any) {
                                                    toast.error("Force attempt failed", {
                                                      description: error?.response?.data?.error?.message || error.message || "Failed to force attempt cycle",
                                                    });
                                                  }
                                                }}
                                                variant="outline"
                                                className="text-xs px-2 py-1 h-auto rounded-sm"
                                                size="sm"
                                                disabled={isForcing}
                                              >
                                                {isForcing ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <RefreshCw className="h-3 w-3" />
                                                )}
                                                Force
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Active Subscription</CardTitle>
                  <CardDescription>
                    Create a subscription to unlock premium features
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/dashboard/subscriptions/create">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Subscribe
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={showSimulateDialog} onOpenChange={setShowSimulateDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simulate Cycle Payment</DialogTitle>
          <DialogDescription className="text-sm">
            This feature is only available in development and staging environments.
            Enter the billing cycle ID and amount to simulate a payment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="billingCycleId" className="text-sm">Billing Cycle ID</Label>
            <Input
              id="billingCycleId"
              placeholder="Enter billing cycle ID"
              value={billingCycleId}
              onChange={(e) => setBillingCycleId(e.target.value)}
              disabled={isSimulating}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Enter amount (e.g., 10000 for 100.00)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSimulating}
              className="text-sm"
            />
            <p className="text-xs text-gray-500">
              Enter amount in cents (e.g., 10000 = 100.00). Use a low amount to test failures.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              setShowSimulateDialog(false);
              setBillingCycleId("");
              setAmount("");
            }}
            disabled={isSimulating}
            className="w-full sm:w-auto order-2 sm:order-1"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSimulateCyclePayment}
            disabled={isSimulating || !billingCycleId.trim() || !amount.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
            className="bg-yellow-500 hover:bg-yellow-600 text-white w-full sm:w-auto order-1 sm:order-2"
            size="sm"
          >
            {isSimulating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Simulate Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showCancelDialog !== null} onOpenChange={(open) => setShowCancelDialog(open ? showCancelDialog : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Subscription</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel your subscription? This will stop all future billing cycles.
            You will continue to have access until the end of your current billing period.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowCancelDialog(null)}
            disabled={isCancelling}
          >
            Keep Subscription
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancelSubscription}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Yes, Cancel Subscription"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!showUpdateDialog} onOpenChange={(open) => !open && setShowUpdateDialog(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Subscription Plan</DialogTitle>
          <DialogDescription className="text-sm">
            Select a new plan to change your subscription. Upgrades take effect immediately with prorated billing.
            Downgrades will take effect on your next billing cycle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {isLoadingPlans ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {plans
                .filter((plan) => plan.id !== activeSubscription?.subscriptionPlan?.id)
                .map((plan) => (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all border-2 ${
                      selectedPlanId === plan.id
                        ? "ring-2 ring-blue-600 border-blue-600 border-blue-600"
                        : "border-gray-300 hover:border-gray-400 hover:shadow-md"
                    }`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{plan.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm font-medium">
                              {formatCurrency(plan.priceCents / 100, plan.priceCurrency)} / {plan.interval}
                            </p>
                            <p className="text-xs text-gray-500">{plan.tokenLimit} tokens included</p>
                          </div>
                        </div>
                        {selectedPlanId === plan.id && (
                          <Check className="h-5 w-5 text-blue-600 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              {plans.filter((plan) => plan.id !== activeSubscription?.subscriptionPlan?.id).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No other plans available</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              setShowUpdateDialog(null);
              setSelectedPlanId("");
            }}
            disabled={isUpdating}
            className="w-full sm:w-auto order-2 sm:order-1"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateSubscription}
            disabled={isUpdating || !selectedPlanId || isLoadingPlans}
            className="w-full sm:w-auto order-1 sm:order-2"
            size="sm"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 mr-2" />
                Update Plan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default SpaceSettingsTab;
