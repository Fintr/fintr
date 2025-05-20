import React from "react";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Button } from "../../ui/button";
import { Upload, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Calendar } from "../../ui/calendar";
import { format } from "date-fns";

interface InvestmentFormProps {
  investmentForm: {
    amount: string;
    name: string;
    description: string;
    category: string;
    receipt: File | null;
  };
  setInvestmentForm: React.Dispatch<
    React.SetStateAction<{
      amount: string;
      name: string;
      description: string;
      category: string;
      receipt: File | null;
    }>
  >;
  customInvestmentCategories: string[];
  setCustomInvestmentCategories: React.Dispatch<React.SetStateAction<string[]>>;
  handleFileUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    formType: string,
  ) => void;
  showCustomCategoryInput: boolean;
  setShowCustomCategoryInput: React.Dispatch<React.SetStateAction<boolean>>;
  customCategory: string;
  setCustomCategory: React.Dispatch<React.SetStateAction<string>>;
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
}

const InvestmentForm: React.FC<InvestmentFormProps> = ({
  investmentForm,
  setInvestmentForm,
  customInvestmentCategories,
  setCustomInvestmentCategories,
  handleFileUpload,
  showCustomCategoryInput,
  setShowCustomCategoryInput,
  customCategory,
  setCustomCategory,
  date,
  setDate,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMMM d, yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="investment-amount">Amount</Label>
          <Input
            id="investment-amount"
            type="number"
            placeholder="0.00"
            value={investmentForm.amount}
            onChange={(e) =>
              setInvestmentForm({
                ...investmentForm,
                amount: e.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="investment-name">Investment Name</Label>
          <Input
            id="investment-name"
            placeholder="Enter investment name"
            value={investmentForm.name}
            onChange={(e) =>
              setInvestmentForm({
                ...investmentForm,
                name: e.target.value,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investment-category">Investment Category</Label>
          <Select
            value={investmentForm.category}
            onValueChange={(value) => {
              if (value === "add_category") {
                setShowCustomCategoryInput(true);
                setInvestmentForm({ ...investmentForm, category: "" });
              } else {
                setShowCustomCategoryInput(false);
                setInvestmentForm({ ...investmentForm, category: value });
              }
            }}
          >
            <SelectTrigger id="investment-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="insurance">Insurance</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="real-estate">Real Estate</SelectItem>
              <SelectItem value="stocks">Stocks</SelectItem>
              <SelectItem value="mutual-funds">Mutual Funds</SelectItem>

              {customInvestmentCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
              <SelectItem value="add_category">
                + Add Investment Category
              </SelectItem>
            </SelectContent>
          </Select>

          {showCustomCategoryInput && (
            <div className="mt-2">
              <Input
                placeholder="Enter new investment category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customCategory.trim() !== "") {
                    setCustomInvestmentCategories([
                      ...customInvestmentCategories,
                      customCategory,
                    ]);
                    setInvestmentForm({
                      ...investmentForm,
                      category: customCategory,
                    });
                    setCustomCategory("");
                    setShowCustomCategoryInput(false);
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCustomCategoryInput(false);
                    setCustomCategory("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (customCategory.trim() !== "") {
                      setCustomInvestmentCategories([
                        ...customInvestmentCategories,
                        customCategory,
                      ]);
                      setInvestmentForm({
                        ...investmentForm,
                        category: customCategory,
                      });
                      setCustomCategory("");
                      setShowCustomCategoryInput(false);
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="investment-description">Note (Optional)</Label>
          <Input
            id="investment-description"
            placeholder="Add details about this investment"
            value={investmentForm.description}
            onChange={(e) =>
              setInvestmentForm({
                ...investmentForm,
                description: e.target.value,
              })
            }
          />
        </div>
        <div className="space-y-2">
          {/* This div is intentionally left empty to maintain the grid layout */}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Attach Doc (Optional)</Label>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() =>
            document.getElementById("investment-receipt-upload")?.click()
          }
        >
          <div className="flex flex-col items-center">
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              Drag & drop your document here or{" "}
              <span className="text-[#0A3D62] font-medium">browse files</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports: JPG, PNG, PDF (Max 5MB)
            </p>
            {investmentForm.receipt && (
              <p className="text-sm text-green-600 mt-2">
                File selected: {investmentForm.receipt.name}
              </p>
            )}
          </div>
          <input
            id="investment-receipt-upload"
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => handleFileUpload(e, "investment")}
          />
        </div>
      </div>
    </div>
  );
};

export default InvestmentForm;
