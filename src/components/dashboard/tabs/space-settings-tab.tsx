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
import { ImportWizard } from "@/components/import/import-wizard";
import { ImportResults } from "@/components/import/import-results";
import { useTransactionCategories } from "@/hooks/async/useTransactionCategories";
import { useAccounts } from "@/hooks/async/useAccounts";
import { useImports } from "@/hooks/async/useImport";
import { getColor, shouldShowV2Features } from "@/lib/utils";
import { TransactionCategory } from "@/types/transactionCategoryTypes";
import { Account } from "@/types/accountTypes";
import { toast } from "sonner";
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

const SpaceSettingsTab = () => {
  const [activeMainTab, setActiveMainTab] = useState("categories");
  const [activeSubTab, setActiveSubTab] = useState("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryToggleType>("expense");
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
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
              <p className="bg-red-800 mb-4">Failed to load categories. Please try again.</p>
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
          <Button
            variant={activeMainTab === "import" ? "default" : "outline"}
            className={activeMainTab === "import" ? "bg-primary" : "bg-white"}
            onClick={() => setActiveMainTab("import")}
          >
            <Download className="h-4 w-4 mr-2" /> Import
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
              <h3 className="text-xl font-medium mb-4">
                Import
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
      </CardContent>
    </Card>
  );
};

export default SpaceSettingsTab;
