"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  ChevronRight,
  CreditCard,
  DollarSign,
  Layers,
  Target,
  CreditCardIcon,
} from "lucide-react";

const STEPS = [
  {
    id: "currency",
    title: "Currency",
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    id: "categories",
    title: "Categories",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    id: "accounts",
    title: "Accounts",
    icon: <CreditCard className="h-5 w-5" />,
  },
  { id: "budget", title: "Budget", icon: <Target className="h-5 w-5" /> },
  {
    id: "freedom",
    title: "Financial Freedom",
    icon: <Check className="h-5 w-5" />,
  },
  {
    id: "payment",
    title: "Payment",
    icon: <CreditCard className="h-5 w-5" />,
  },
];

const AccountSetupFlow = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    currency: "PHP",
    categories: [
      { name: "Food", color: "oklch(59.6% 0.145 163.225)", isSelected: true },
      { name: "Transportation", color: "#D6A3A1", isSelected: true },
      { name: "Entertainment", color: "#FF6F61", isSelected: true },
      { name: "Utilities", color: "oklch(39.6% 0.141 25.723)", isSelected: true },
      { name: "Shopping", color: "#CC5500", isSelected: true },
      { name: "House", color: "#3D8D7F", isSelected: true },
    ],
    accounts: [
      { name: "Cash", color: "oklch(59.6% 0.145 163.225)", balance: "", isSelected: false },
      {
        name: "Checking Account",
        color: "#D6A3A1",
        balance: "",
        isSelected: false,
      },
      {
        name: "Savings Account",
        color: "#FF6F61",
        balance: "",
        isSelected: false,
      },
      { name: "Credit Card", color: "oklch(39.6% 0.141 25.723)", balance: "", isSelected: false },
      { name: "E-Wallet", color: "#CC5500", balance: "", isSelected: false },
    ],
    budget: "",
    budgetCategories: [
      { name: "House/Condo", amount: "", color: "#D6A3A1", isSelected: true },
      { name: "Food", amount: "", color: "#FF6F61", isSelected: true },
      { name: "Utilities", amount: "", color: "oklch(39.6% 0.141 25.723)", isSelected: true },
      {
        name: "Transportation",
        amount: "",
        color: "#CC5500",
        isSelected: true,
      },
      { name: "Entertainment", amount: "", color: "#5EB99D", isSelected: true },
      { name: "Shopping", amount: "", color: "#6A5ACD", isSelected: true },
    ],
    financialFreedom: "",
    paymentMethod: "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
  });

  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingAccountIndex, setEditingAccountIndex] = useState<number | null>(null);
  const [editingBudgetCategoryIndex, setEditingBudgetCategoryIndex] = useState<number | null>(null);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit the form and redirect to dashboard
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSubmit = () => {

    // Redirect to dashboard
    router.push("/dashboard");
  };

  const updateFormData = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const toggleCategory = (index: number) => {
    const updatedCategories = [...formData.categories];
    updatedCategories[index].isSelected = !updatedCategories[index].isSelected;
    setFormData({ ...formData, categories: updatedCategories });
  };

  const updateCategoryName = (index: number, name: string) => {
    const updatedCategories = [...formData.categories];
    updatedCategories[index].name = name;
    setFormData({ ...formData, categories: updatedCategories });
  };

  const toggleAccount = (index: number) => {
    const updatedAccounts = [...formData.accounts];
    updatedAccounts[index].isSelected = !updatedAccounts[index].isSelected;
    setFormData({ ...formData, accounts: updatedAccounts });
  };

  const updateAccountName = (index: number, name: string) => {
    const updatedAccounts = [...formData.accounts];
    updatedAccounts[index].name = name;
    setFormData({ ...formData, accounts: updatedAccounts });
  };

  // Calculate total budget from all categories
  const calculateTotalBudget = () => {
    return formData.budgetCategories
      .reduce((total, category) => {
        const amount = parseFloat(category.amount) || 0;
        return total + amount;
      }, 0)
      .toFixed(2);
  };

  const updateBudgetCategoryAmount = (index: number, amount: string) => {
    const updatedBudgetCategories = [...formData.budgetCategories];
    updatedBudgetCategories[index].amount = amount;
    setFormData({ ...formData, budgetCategories: updatedBudgetCategories });
  };

  const updateBudgetCategoryName = (index: number, name: string) => {
    const updatedBudgetCategories = [...formData.budgetCategories];
    updatedBudgetCategories[index].name = name;
    setFormData({ ...formData, budgetCategories: updatedBudgetCategories });
  };

  const getCurrencySymbol = () => {
    switch (formData.currency) {
      case "PHP":
        return "₱";
      case "USD":
        return "$";
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      default:
        return "¥";
    }
  };

  const renderStepContent = () => {
    const step = STEPS[currentStep];

    switch (step.id) {
      case "currency":
        return (
          <div className="space-y-4">
            <CardHeader>
              <CardTitle>Select Your Preferred Currency</CardTitle>
              <CardDescription>
                Choose the currency you want to use for your financial tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => updateFormData("currency", value)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHP">Philippine Peso (₱)</SelectItem>
                    <SelectItem value="USD">US Dollar ($)</SelectItem>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                    <SelectItem value="GBP">British Pound (£)</SelectItem>
                    <SelectItem value="JPY">Japanese Yen (¥)</SelectItem>
                    <SelectItem value="AUD">Australian Dollar (A$)</SelectItem>
                    <SelectItem value="CAD">Canadian Dollar (C$)</SelectItem>
                    <SelectItem value="CHF">Swiss Franc (Fr)</SelectItem>
                    <SelectItem value="CNY">Chinese Yuan (¥)</SelectItem>
                    <SelectItem value="HKD">Hong Kong Dollar (HK$)</SelectItem>
                    <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                    <SelectItem value="KRW">South Korean Won (₩)</SelectItem>
                    <SelectItem value="MXN">Mexican Peso (Mex$)</SelectItem>
                    <SelectItem value="NZD">
                      New Zealand Dollar (NZ$)
                    </SelectItem>
                    <SelectItem value="SGD">Singapore Dollar (S$)</SelectItem>
                    <SelectItem value="THB">Thai Baht (฿)</SelectItem>
                    <SelectItem value="ZAR">South African Rand (R)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </div>
        );

      case "categories":
        return (
          <div className="space-y-4">
            <CardHeader>
              <CardTitle>Customize Your Categories</CardTitle>
              <CardDescription>
                Select the expense categories you want to track
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {formData.categories.map((category, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${category.isSelected ? "border-primary bg-primary/5" : "border-gray-200"}`}
                    >
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: category.color }}
                        />
                        {editingCategoryIndex === index ? (
                          <Input
                            value={category.name}
                            onChange={(e) =>
                              updateCategoryName(index, e.target.value)
                            }
                            onBlur={() => setEditingCategoryIndex(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setEditingCategoryIndex(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 h-7 py-0 px-1"
                          />
                        ) : (
                          <span
                            className="font-medium flex-1"
                            onClick={() => setEditingCategoryIndex(index)}
                          >
                            {category.name}
                          </span>
                        )}
                        <div
                          className="ml-2 cursor-pointer"
                          onClick={() => toggleCategory(index)}
                        >
                          {category.isSelected && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="w-full border-dashed border-primary text-primary hover:bg-primary/5"
                    onClick={() => {
                      const newCategory = {
                        name: "New Category",
                        color: "#5EB99D",
                        isSelected: true,
                      };
                      const updatedCategories = [
                        ...formData.categories,
                        newCategory,
                      ];
                      setFormData({
                        ...formData,
                        categories: updatedCategories,
                      });
                      setEditingCategoryIndex(formData.categories.length);
                    }}
                  >
                    + Add Custom Category
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        );

      case "accounts":
        return (
          <div className="space-y-4">
            <CardHeader>
              <CardTitle>Add Your Accounts</CardTitle>
              <CardDescription>
                Select and add your financial accounts to track
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {formData.accounts.map((account, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${account.isSelected ? "border-primary bg-primary/5" : "border-gray-200"}`}
                      onClick={() => toggleAccount(index)}
                    >
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: account.color }}
                        />
                        {editingAccountIndex === index ? (
                          <Input
                            value={account.name}
                            onChange={(e) =>
                              updateAccountName(index, e.target.value)
                            }
                            onBlur={() => setEditingAccountIndex(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setEditingAccountIndex(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 h-7 py-0 px-1"
                          />
                        ) : (
                          <span
                            className="font-medium flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAccountIndex(index);
                            }}
                          >
                            {account.name}
                          </span>
                        )}
                        <div className="ml-2">
                          {account.isSelected && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="w-full border-dashed border-primary text-primary hover:bg-primary/5"
                    onClick={() => {
                      // Generate a random color for the new account
                      const colors = [
                        "oklch(59.6% 0.145 163.225)",
                        "#D6A3A1",
                        "#FF6F61",
                        "oklch(39.6% 0.141 25.723)",
                        "#CC5500",
                        "#3D8D7F",
                        "#5EB99D",
                        "#6A5ACD",
                      ];
                      const randomColor =
                        colors[Math.floor(Math.random() * colors.length)];

                      const newAccount = {
                        name: "New Account",
                        color: randomColor,
                        balance: "",
                        isSelected: true,
                      };
                      const updatedAccounts = [
                        ...formData.accounts,
                        newAccount,
                      ];
                      setFormData({ ...formData, accounts: updatedAccounts });
                      setEditingAccountIndex(formData.accounts.length);
                    }}
                  >
                    + Add New Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        );

      case "budget":
        return (
          <div className="space-y-4">
            <CardHeader>
              <CardTitle>Set Your Monthly Budget</CardTitle>
              <CardDescription>
                Define your overall monthly budget to help track your spending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="budget">Monthly Budget Total</Label>
                  <div className="text-lg font-semibold text-primary">
                    {getCurrencySymbol()}
                    {calculateTotalBudget()}
                  </div>
                </div>

                <div className="mt-6">
                  <Label className="mb-2 block">Budget Categories</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {formData.budgetCategories.map((category, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg border transition-colors border-primary bg-primary/5"
                      >
                        <div className="flex items-center">
                          <div
                            className="w-4 h-4 rounded-full mr-2"
                            style={{ backgroundColor: category.color }}
                          />
                          {editingBudgetCategoryIndex === index ? (
                            <Input
                              value={category.name}
                              onChange={(e) =>
                                updateBudgetCategoryName(index, e.target.value)
                              }
                              onBlur={() => setEditingBudgetCategoryIndex(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  setEditingBudgetCategoryIndex(null);
                                }
                              }}
                              autoFocus
                              className="flex-1 h-7 py-0 px-1 mr-2"
                            />
                          ) : (
                            <span
                              className="font-medium flex-1 mr-2"
                              onClick={() =>
                                setEditingBudgetCategoryIndex(index)
                              }
                            >
                              {category.name}
                            </span>
                          )}
                          <div className="flex items-center">
                            <span className="text-gray-500 mr-1">
                              {getCurrencySymbol()}
                            </span>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={category.amount}
                              onChange={(e) =>
                                updateBudgetCategoryAmount(
                                  index,
                                  e.target.value,
                                )
                              }
                              className="w-24 h-7 py-0 px-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full border-dashed border-primary text-primary hover:bg-primary/5 mt-3"
                    onClick={() => {
                      // Generate a random color for the new budget category
                      const colors = [
                        "oklch(59.6% 0.145 163.225)",
                        "#D6A3A1",
                        "#FF6F61",
                        "oklch(39.6% 0.141 25.723)",
                        "#CC5500",
                        "#3D8D7F",
                        "#5EB99D",
                        "#6A5ACD",
                      ];
                      const randomColor =
                        colors[Math.floor(Math.random() * colors.length)];

                      const newCategory = {
                        name: "New Category",
                        amount: "",
                        color: randomColor,
                        isSelected: true,
                      };
                      const updatedBudgetCategories = [
                        ...formData.budgetCategories,
                        newCategory,
                      ];
                      setFormData({
                        ...formData,
                        budgetCategories: updatedBudgetCategories,
                      });
                      setEditingBudgetCategoryIndex(
                        formData.budgetCategories.length,
                      );
                    }}
                  >
                    + Add Category
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        );

      case "freedom":
        return (
          <div className="space-y-4">
            <CardHeader>
              <CardTitle>Define Your Financial Freedom</CardTitle>
              <CardDescription>
                What does financial freedom mean to you? This will help us
                personalize your experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  id="financial-freedom"
                  placeholder="E.g., Having enough passive income to cover my expenses and being able to travel 3 months a year."
                  value={formData.financialFreedom}
                  onChange={(e) =>
                    updateFormData("financialFreedom", e.target.value)
                  }
                  rows={4}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </div>
        );

      case "payment":
        return (
          <div className="space-y-4">
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
              <CardDescription>
                Add your payment details to complete the setup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      updateFormData("paymentMethod", value)
                    }
                  >
                    <SelectTrigger id="payment-method" className="mt-1">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit-card">Credit Card</SelectItem>
                      <SelectItem value="debit-card">Debit Card</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.paymentMethod === "credit-card" ||
                  formData.paymentMethod === "debit-card") && (
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <div className="mb-4">
                        <Label
                          htmlFor="card-number"
                          className="text-sm text-gray-600"
                        >
                          Card Number
                        </Label>
                        <div className="mt-1 relative">
                          <Input
                            id="card-number"
                            placeholder="1234 5678 9012 3456"
                            value={formData.cardNumber}
                            onChange={(e) =>
                              updateFormData("cardNumber", e.target.value)
                            }
                            className="pr-10 font-mono"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <CreditCard className="h-5 w-5 text-gray-400" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label
                            htmlFor="expiry-date"
                            className="text-sm text-gray-600"
                          >
                            Expiry Date
                          </Label>
                          <Input
                            id="expiry-date"
                            placeholder="MM / YY"
                            value={formData.expiryDate}
                            onChange={(e) =>
                              updateFormData("expiryDate", e.target.value)
                            }
                            className="mt-1 font-mono"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="cvv"
                            className="text-sm text-gray-600"
                          >
                            Security Code
                          </Label>
                          <Input
                            id="cvv"
                            placeholder="CVC"
                            value={formData.cvv}
                            onChange={(e) =>
                              updateFormData("cvv", e.target.value)
                            }
                            className="mt-1 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <span>
                          Your payment info is secured with SSL encryption
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {formData.paymentMethod === "paypal" && (
                  <div className="p-4 border rounded-lg bg-blue-50 text-center">
                    <p className="text-blue-600 mb-2">
                      You will be redirected to PayPal to complete your payment.
                    </p>
                    <Button className="bg-blue-500 hover:bg-blue-600">
                      Continue with PayPal
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <img
              src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png"
              alt="Fintr Logo"
              className="h-12"
            />
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-primary">
              Account Setup ({currentStep + 1}/{STEPS.length})
            </h1>
            <div className="text-sm text-primary/70">
              {currentStep < STEPS.length - 1
                ? "You can always change these settings later"
                : "Almost done!"}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step, index) => (
              <div
                key={index}
                className={`flex flex-col items-center ${index <= currentStep ? "text-primary" : "text-gray-400"}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${index <= currentStep ? "bg-primary text-white" : "bg-gray-200"}`}
                >
                  {step.icon}
                </div>
                <span className="text-xs font-medium">{step.title}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <Card>
          {renderStepContent()}
          <CardFooter className="flex justify-between pt-6">
            <div>
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack}>
                  Back  
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              {currentStep < STEPS.length - 1 && currentStep > 0 && (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip
                </Button>
              )}
              <Button
                className="bg-primary hover:bg-primary/80"
                onClick={handleNext}
              >
                {currentStep === STEPS.length - 1 ? "Finish" : "Next"}
                {currentStep < STEPS.length - 1 && (
                  <ChevronRight className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default AccountSetupFlow;
