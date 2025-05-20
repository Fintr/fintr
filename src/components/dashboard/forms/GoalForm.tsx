import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GoalFormProps {
  goalForm: {
    amount: string;
    name: string;
    description: string;
    category: string;
    targetDate: Date;
    receipt: File | null;
    monthlyContribution: string;
    priority: string;
  };
  setGoalForm: React.Dispatch<
    React.SetStateAction<{
      amount: string;
      name: string;
      description: string;
      category: string;
      targetDate: Date;
      receipt: File | null;
      monthlyContribution: string;
      priority: string;
    }>
  >;
  handleFileUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    formType: string
  ) => void;
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
}

const GoalForm = ({
  goalForm,
  setGoalForm,
  handleFileUpload,
  date,
  setDate,
}: GoalFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Date Picker */}
        <div>
          <Label htmlFor="goal-date">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                id="goal-date"
                className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
              >
                {date ? format(date, "PP") : <span>Pick a date</span>}
                <CalendarIcon className="h-4 w-4 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Goal Name */}
        <div>
          <Label htmlFor="goal-name">Goal Name</Label>
          <Input
            id="goal-name"
            placeholder="New Car, Vacation, etc."
            value={goalForm.name}
            onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
          />
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="goal-category">Category</Label>
          <Select
            value={goalForm.category}
            onValueChange={(value) =>
              setGoalForm({ ...goalForm, category: value })
            }
          >
            <SelectTrigger id="goal-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debt-payoff">Debt Pay-Off</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="retirement">Retirement</SelectItem>
              <SelectItem value="home">Home</SelectItem>
              <SelectItem value="education">Education</SelectItem>
              <SelectItem value="investment">Investment</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="big-purchase">Big Purchase</SelectItem>
              <SelectItem value="life-milestone">Life Milestone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Goal Amount */}
        <div>
          <Label htmlFor="goal-amount">Goal Amount</Label>
          <Input
            id="goal-amount"
            type="number"
            placeholder="0.00"
            value={goalForm.amount}
            onChange={(e) =>
              setGoalForm({ ...goalForm, amount: e.target.value })
            }
          />
        </div>

        {/* Monthly Contribution */}
        <div>
          <Label htmlFor="goal-monthly-contribution">
            Monthly Contribution
          </Label>
          <Input
            id="goal-monthly-contribution"
            type="number"
            placeholder="0.00"
            value={goalForm.monthlyContribution || ""}
            onChange={(e) =>
              setGoalForm({ ...goalForm, monthlyContribution: e.target.value })
            }
          />
        </div>

        {/* Priority */}
        <div>
          <Label htmlFor="goal-priority">Priority</Label>
          <Select
            value={goalForm.priority || "medium"}
            onValueChange={(value) =>
              setGoalForm({ ...goalForm, priority: value })
            }
          >
            <SelectTrigger id="goal-priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Target Date and Notes on the same row */}
        <div>
          <Label htmlFor="goal-target-date">Goal Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                id="goal-target-date"
                className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
              >
                {goalForm.targetDate ? (
                  format(goalForm.targetDate, "PP")
                ) : (
                  <span>Pick a target date</span>
                )}
                <CalendarIcon className="h-4 w-4 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={goalForm.targetDate}
                onSelect={(date) =>
                  setGoalForm({ ...goalForm, targetDate: date || new Date() })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Notes (Optional) */}
        <div>
          <Label htmlFor="goal-description">Notes (Optional)</Label>
          <Input
            id="goal-description"
            placeholder="Additional notes"
            value={goalForm.description}
            onChange={(e) =>
              setGoalForm({ ...goalForm, description: e.target.value })
            }
          />
        </div>
      </div>

      {/* Receipt Upload - Full Width with new styling */}
      <div>
        <Label htmlFor="goal-receipt">Attach Doc (Optional)</Label>
        <div className="mt-1">
          <Input
            id="goal-receipt"
            type="file"
            className="hidden"
            onChange={(e) => handleFileUpload(e, "goal")}
          />
          <label
            htmlFor="goal-receipt"
            className="flex flex-col items-center justify-center w-full h-32 px-4 py-6 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-sm text-center text-gray-600">
                Drag & drop your document here or{" "}
                <span className="text-primary font-medium">browse files</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports: JPG, PNG, PDF (Max 5MB)
              </p>
              {goalForm.receipt && (
                <p className="text-sm text-green-600 mt-2">
                  {goalForm.receipt.name}
                </p>
              )}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default GoalForm;
