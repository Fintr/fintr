import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import InvestmentForm from "../forms/InvestmentForm";

interface InvestmentsTabProps {
  formatCurrency: (amount: number) => string;
}

const InvestmentsTab = ({ formatCurrency }: InvestmentsTabProps) => {
  const [showInvestmentForm, setShowInvestmentForm] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [investmentForm, setInvestmentForm] = useState({
    amount: "",
    name: "",
    description: "",
    category: "",
    receipt: null as File | null,
  });
  const [customInvestmentCategories, setCustomInvestmentCategories] = useState<
    string[]
  >([]);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [investments, setInvestments] = useState<any[]>([]);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    formType: string,
  ) => {
    if (e.target.files && e.target.files[0]) {
      setInvestmentForm({
        ...investmentForm,
        receipt: e.target.files[0],
      });
    }
  };

  const handleSubmit = () => {
    // Create a new investment object
    const newInvestment = {
      id: Date.now().toString(),
      name: investmentForm.name,
      amount: parseFloat(investmentForm.amount),
      category: investmentForm.category,
      description: investmentForm.description,
      date: date,
      receipt: investmentForm.receipt ? investmentForm.receipt.name : null,
      // Add additional fields as needed
      purchaseAmount: parseFloat(investmentForm.amount) * 0.85, // Dummy calculation
      appreciation: "15%", // Dummy value
    };

    // Add the new investment to the investments array
    setInvestments([...investments, newInvestment]);

    // Reset the form
    setInvestmentForm({
      amount: "",
      name: "",
      description: "",
      category: "",
      receipt: null,
    });
    setDate(new Date());

    // Close the dialog
    setShowInvestmentForm(false);
  };

  // Group investments by category
  const groupedInvestments = investments.reduce(
    (acc, investment) => {
      const category = investment.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(investment);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  // Combine with existing static investments
  const allInvestments = {
    Insurance: [
      {
        id: "ins1",
        name: "Life Insurance - Premium Plan",
        amount: 250000,
        purchaseAmount: 200000,
        appreciation: "+25%",
      },
      {
        id: "ins2",
        name: "Health Insurance - Family Coverage",
        amount: 180000,
        purchaseAmount: 200000,
        appreciation: "-10%",
      },
      ...(groupedInvestments["insurance"] || []),
    ],
    "Real Estate": [
      {
        id: "1",
        name: "Condominium Unit - Makati",
        amount: 1800000,
        purchaseAmount: 1500000,
        appreciation: "+20%",
      },
      {
        id: "2",
        name: "Lot - Cavite",
        amount: 500000,
        purchaseAmount: 350000,
        appreciation: "+42.8%",
      },
      ...(groupedInvestments["real-estate"] || []),
    ],
    Stocks: [
      {
        id: "3",
        name: "ACEN (AC Energy)",
        amount: 120000,
        shares: 10000,
        currentPrice: 12.0,
        avgCost: 10.5,
        gain: "+14.3%",
      },
      {
        id: "4",
        name: "SM (SM Investments)",
        amount: 80000,
        shares: 800,
        currentPrice: 100.0,
        avgCost: 105.5,
        gain: "-5.2%",
      },
      ...(groupedInvestments["stocks"] || []),
    ],
    ...Object.keys(groupedInvestments)
      .filter((category) => category !== "real-estate" && category !== "stocks")
      .reduce(
        (acc, category) => {
          acc[category.charAt(0).toUpperCase() + category.slice(1)] =
            groupedInvestments[category];
          return acc;
        },
        {} as Record<string, any[]>,
      ),
  };

  return (
    <Card className="border-0 bg-[#FAF9F6] shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Investment Portfolio</CardTitle>
          <CardDescription>
            Track and manage your investment assets
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            className="bg-[#0A3D62] hover:bg-[#0A3D62]/80"
            onClick={() => setShowInvestmentForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Investment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Investment Summary Section */}
        <div className="mb-8 p-6 border border-[#e5e7eb] rounded-lg bg-white">
          <h3 className="text-lg font-semibold text-[#0A3D62] mb-4">
            Investment Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <div className="bg-[#f9f7f5] p-4 rounded-lg">
              <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                Total Investments
              </h4>
              <div className="text-2xl font-bold text-[#0A3D62]">
                {formatCurrency(2500000)}
              </div>
            </div>
            <div className="bg-[#f9f7f5] p-4 rounded-lg">
              <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                Total Returns
              </h4>
              <div
                className={`text-2xl font-bold ${320000 >= 0 ? "text-[#008080]" : "text-[#800020]"}`}
              >
                {320000 >= 0 ? "+" : ""}
                {formatCurrency(320000)}
              </div>
            </div>
            <div className="bg-[#f9f7f5] p-4 rounded-lg">
              <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                ROI
              </h4>
              <div className="text-2xl font-bold text-[#008080]">+12.8%</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(allInvestments).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((investment) => (
                    <div
                      key={investment.id}
                      className="p-4 border rounded-lg bg-white"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-[#0A3D62]">
                          {investment.name}
                        </h3>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-[#0A3D62]"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-pencil"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-trash-2"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              <line x1="10" x2="10" y1="11" y2="17" />
                              <line x1="14" x2="14" y1="11" y2="17" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm text-[#0A3D62]/70 mb-2">
                        {investment.purchaseAmount && (
                          <span>
                            Purchase:{" "}
                            {formatCurrency(investment.purchaseAmount)}
                          </span>
                        )}
                        <div className="flex items-center space-x-2">
                          <span>{formatCurrency(investment.amount)}</span>
                          {investment.appreciation && (
                            <span
                              className={`${investment.appreciation.startsWith("-") ? "text-[#800020] font-medium" : "text-[#008080] font-medium"}`}
                            >
                              {investment.appreciation}
                            </span>
                          )}
                          {investment.gain && (
                            <span
                              className={`${investment.gain.startsWith("-") ? "text-[#800020] font-medium" : "text-[#008080] font-medium"}`}
                            >
                              ({investment.gain})
                            </span>
                          )}
                        </div>
                        {investment.shares && (
                          <>
                            <span>
                              Shares: {investment.shares.toLocaleString()}
                            </span>
                            <span>
                              Current: ₱{investment.currentPrice.toFixed(2)}
                            </span>
                            <span>
                              Avg. Cost: ₱{investment.avgCost.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>

      {/* Investment Form Dialog */}
      <Dialog open={showInvestmentForm} onOpenChange={setShowInvestmentForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Investment</DialogTitle>
          </DialogHeader>
          <InvestmentForm
            investmentForm={investmentForm}
            setInvestmentForm={setInvestmentForm}
            customInvestmentCategories={customInvestmentCategories}
            setCustomInvestmentCategories={setCustomInvestmentCategories}
            handleFileUpload={handleFileUpload}
            showCustomCategoryInput={showCustomCategoryInput}
            setShowCustomCategoryInput={setShowCustomCategoryInput}
            customCategory={customCategory}
            setCustomCategory={setCustomCategory}
            date={date}
            setDate={setDate}
          />
          <DialogFooter className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setShowInvestmentForm(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#0A3D62] hover:bg-[#0A3D62]/80"
              onClick={handleSubmit}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default InvestmentsTab;
