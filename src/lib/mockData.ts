// Mock data for the dashboard
type Transaction = {
  id: number;
  description: string;
  amount: number;
  date: string;
  category: string;
  subcategory: string;
};
// Generate random transactions for each month
export const generateMockTransactions = () => {
  const years = [2021, 2022, 2023, 2024, 2025];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const incomeCategories = [
    { name: "Salary", min: 30000, max: 50000 },
    { name: "Freelance", min: 5000, max: 15000 },
    { name: "Investments", min: 2000, max: 8000 },
    { name: "Rental Income", min: 10000, max: 20000 },
    { name: "Side Business", min: 3000, max: 12000 },
  ];

  const expenseCategories = [
    { name: "Food", min: 3000, max: 10000 },
    { name: "Transportation", min: 2000, max: 5000 },
    { name: "Utilities", min: 1500, max: 4000 },
    { name: "Entertainment", min: 1000, max: 5000 },
    { name: "Shopping", min: 2000, max: 8000 },
  ];

  const transactions: Transaction[] = [];
  let id = 1;

  years.forEach((year) => {
    months.forEach((month) => {
      // Generate 5 income transactions per month
      incomeCategories.forEach((category) => {
        const amount =
          Math.floor(Math.random() * (category.max - category.min + 1)) +
          category.min;
        const day = Math.floor(Math.random() * 28) + 1;
        transactions.push({
          id: id++,
          description: category.name,
          amount: amount,
          date: `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
          category: "Income",
          subcategory: category.name,
        });
      });

      // Generate 5 expense transactions per month
      expenseCategories.forEach((category) => {
        const amount = -(
          Math.floor(Math.random() * (category.max - category.min + 1)) +
          category.min
        );
        const day = Math.floor(Math.random() * 28) + 1;
        transactions.push({
          id: id++,
          description: `${category.name} Expense`,
          amount: amount,
          date: `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
          category: "Expense",
          subcategory: category.name,
        });
      });
    });
  });

  return transactions;
};

// Generate mock budgets
export const generateMockBudgets = () => {
  return [
    { name: "Food", spent: 8500, budget: 10000, color: "oklch(59.6% 0.145 163.225)" },
    { name: "Transportation", spent: 3200, budget: 5000, color: "#D6A3A1" },
    { name: "Entertainment", spent: 2800, budget: 3000, color: "#FF6F61" },
    { name: "Utilities", spent: 4500, budget: 6000, color: "oklch(39.6% 0.141 25.723)" },
    { name: "Shopping", spent: 6200, budget: 5000, color: "#CC5500" },
  ];
};

// Generate mock goals
export const generateMockGoals = () => {
  return [
    {
      id: 1,
      name: "Emergency Fund",
      targetAmount: 100000,
      currentAmount: 45000,
      targetDate: "2023-12-31",
      category: "short-term",
      priority: "high",
      monthlyContribution: 5000,
      notes: "3 months of living expenses",
    },
    {
      id: 2,
      name: "Car Down Payment",
      targetAmount: 200000,
      currentAmount: 80000,
      targetDate: "2024-06-30",
      category: "medium-term",
      priority: "medium",
      monthlyContribution: 10000,
      notes: "For a new sedan",
    },
    {
      id: 3,
      name: "Retirement Fund",
      targetAmount: 5000000,
      currentAmount: 500000,
      targetDate: "2045-01-01",
      category: "long-term",
      priority: "medium",
      monthlyContribution: 15000,
      notes: "For comfortable retirement",
    },
  ];
};
