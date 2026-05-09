import React, { useState } from "react";
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
import { CalendarIcon } from "lucide-react";
import { Calendar } from "../../ui/calendar";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { format } from "date-fns";
import ExpandableTextarea from "../../ui/expandable-textarea";
import FileUploadField from "./FileUploadField";

interface InvestmentFormProps {
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  // Props passed from parent for external state management
  investmentForm?: {
    amount: string;
    name: string;
    description: string;
    category: string;
    receipt: File | null;
  };
  setInvestmentForm?: React.Dispatch<React.SetStateAction<{
    amount: string;
    name: string;
    description: string;
    category: string;
    receipt: File | null;
  }>>;
  customInvestmentCategories?: string[];
  setCustomInvestmentCategories?: React.Dispatch<React.SetStateAction<string[]>>;
  handleFileUpload?: (e: React.ChangeEvent<HTMLInputElement>, formType: string) => void;
  showCustomCategoryInput?: boolean;
  setShowCustomCategoryInput?: React.Dispatch<React.SetStateAction<boolean>>;
  customCategory?: string;
  setCustomCategory?: React.Dispatch<React.SetStateAction<string>>;
}

const InvestmentForm: React.FC<InvestmentFormProps> = ({
  date,
  setDate,
  onSubmitSuccess = () => {},
  onCancel = () => {},
  investmentForm: externalInvestmentForm,
  setInvestmentForm: externalSetInvestmentForm,
  customInvestmentCategories: externalCustomInvestmentCategories,
  setCustomInvestmentCategories: externalSetCustomInvestmentCategories,
  handleFileUpload: externalHandleFileUpload,
  showCustomCategoryInput: externalShowCustomCategoryInput,
  setShowCustomCategoryInput: externalSetShowCustomCategoryInput,
  customCategory: externalCustomCategory,
  setCustomCategory: externalSetCustomCategory,
}) => {
  // Use external state if provided, otherwise use internal state
  const [internalInvestmentForm, setInternalInvestmentForm] = useState({
    amount: "",
    name: "",
    description: "",
    category: "",
    receipt: null as File | null,
  });
  
  const [internalShowCustomCategoryInput, setInternalShowCustomCategoryInput] = useState(false);
  const [internalCustomCategory, setInternalCustomCategory] = useState("");
  const [internalCustomInvestmentCategories, setInternalCustomInvestmentCategories] = useState<string[]>([]);

  // Determine which state to use
  const investmentForm = externalInvestmentForm || internalInvestmentForm;
  const setInvestmentForm = externalSetInvestmentForm || setInternalInvestmentForm;
  const customInvestmentCategories = externalCustomInvestmentCategories || internalCustomInvestmentCategories;
  const setCustomInvestmentCategories = externalSetCustomInvestmentCategories || setInternalCustomInvestmentCategories;
  const showCustomCategoryInput = externalShowCustomCategoryInput !== undefined ? externalShowCustomCategoryInput : internalShowCustomCategoryInput;
  const setShowCustomCategoryInput = externalSetShowCustomCategoryInput || setInternalShowCustomCategoryInput;
  const customCategory = externalCustomCategory !== undefined ? externalCustomCategory : internalCustomCategory;
  const setCustomCategory = externalSetCustomCategory || setInternalCustomCategory;
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Handle file upload for this form
  const handleFileUpload = externalHandleFileUpload ? 
    ((e: React.ChangeEvent<HTMLInputElement>) => {
      externalHandleFileUpload(e, "investment");
    }) : 
    ((e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setInvestmentForm((prev) => ({ ...prev, receipt: file }));
      } else {
        setInvestmentForm((prev) => ({ ...prev, receipt: null }));
      }
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date" className="text-sm">Date</Label>
          <CalendarPopover
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            trigger={
              <Button
                variant={"outline"}
                className="w-full justify-start text-left font-normal text-sm"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
              </Button>
            }
          >
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                if (d) setDatePickerOpen(false);
              }}
              autoFocus
            />
          </CalendarPopover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="investment-amount" className="text-sm">Amount</Label>
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
            className="text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="investment-name" className="text-sm">Investment Name</Label>
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
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investment-category" className="text-sm">Investment Category</Label>
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
            <SelectTrigger id="investment-category" className="text-sm">
              <SelectValue placeholder="Select category" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="insurance" className="text-sm">Insurance</SelectItem>
              <SelectItem value="business" className="text-sm">Business</SelectItem>
              <SelectItem value="real-estate" className="text-sm">Real Estate</SelectItem>
              <SelectItem value="stocks" className="text-sm">Stocks</SelectItem>
              <SelectItem value="mutual-funds" className="text-sm">Mutual Funds</SelectItem>

              {customInvestmentCategories.map((category) => (
                <SelectItem key={category} value={category} className="text-sm">
                  {category}
                </SelectItem>
              ))}
              <SelectItem value="add_category" className="text-sm">
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
                className="text-sm"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCustomCategoryInput(false);
                    setCustomCategory("");
                  }}
                  className="text-sm"
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
                  className="text-sm"
                >
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description Field */}
      <div className="w-full">
        <Label htmlFor="investment-description" className="text-sm">Note (Optional)</Label>
        <ExpandableTextarea
          id="investment-description"
          value={investmentForm.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInvestmentForm({ ...investmentForm, description: e.target.value })}
          placeholder="Add additional details"
          className="mt-1"
        />
      </div>

      <FileUploadField
        file={investmentForm.receipt}
        onFileChange={handleFileUpload}
        onRemoveFile={() =>
          setInvestmentForm((prev) => ({ ...prev, receipt: null }))
        }
        label="Attach Doc (Optional)"
      />
    </div>
  );
};

export default InvestmentForm;
