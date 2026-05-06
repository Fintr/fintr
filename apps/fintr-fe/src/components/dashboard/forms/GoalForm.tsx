import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { format } from "date-fns";
import { CalendarIcon, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ExpandableTextarea from "@/components/ui/expandable-textarea";

interface GoalFormProps {
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
}

const GoalForm: React.FC<GoalFormProps> = ({
  date,
  setDate,
  onSubmitSuccess = () => {},
  onCancel = () => {},
}) => {
  // Internal state for the form
  const [goalForm, setGoalForm] = useState({
    amount: "",
    name: "",
    description: "",
    category: "",
    targetDate: new Date(),
    receipt: null as File | null,
    monthlyContribution: "",
    priority: "",
  });
  const [goalDatePickerOpen, setGoalDatePickerOpen] = useState(false);
  const [targetDatePickerOpen, setTargetDatePickerOpen] = useState(false);

  // Handle file upload for this form
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setGoalForm((prev) => ({ ...prev, receipt: file }));
    } else {
      setGoalForm((prev) => ({ ...prev, receipt: null }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Date Picker */}
        <div>
          <Label htmlFor="goal-date" className="text-sm">Date</Label>
          <CalendarPopover
            open={goalDatePickerOpen}
            onOpenChange={setGoalDatePickerOpen}
            align="start"
            trigger={
              <button
                id="goal-date"
                type="button"
                className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
              >
                {date ? format(date, "PP") : <span className="text-sm">Pick a date</span>}
                <CalendarIcon className="h-4 w-4 opacity-50" />
              </button>
            }
          >
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                if (d) setGoalDatePickerOpen(false);
              }}
              initialFocus
            />
          </CalendarPopover>
        </div>

        {/* Goal Name */}
        <div>
          <Label htmlFor="goal-name" className="text-sm">Goal Name</Label>
          <Input
            id="goal-name"
            placeholder="New Car, Vacation, etc."
            value={goalForm.name}
            onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
            className="text-sm"
          />
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="goal-category" className="text-sm">Category</Label>
          <Select
            value={goalForm.category}
            onValueChange={(value) =>
              setGoalForm({ ...goalForm, category: value })
            }
          >
            <SelectTrigger id="goal-category" className="text-sm">
              <SelectValue placeholder="Select category" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debt-payoff" className="text-sm">Debt Pay-Off</SelectItem>
              <SelectItem value="emergency" className="text-sm">Emergency</SelectItem>
              <SelectItem value="retirement" className="text-sm">Retirement</SelectItem>
              <SelectItem value="home" className="text-sm">Home</SelectItem>
              <SelectItem value="education" className="text-sm">Education</SelectItem>
              <SelectItem value="investment" className="text-sm">Investment</SelectItem>
              <SelectItem value="business" className="text-sm">Business</SelectItem>
              <SelectItem value="big-purchase" className="text-sm">Big Purchase</SelectItem>
              <SelectItem value="life-milestone" className="text-sm">Life Milestone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Goal Amount */}
        <div>
          <Label htmlFor="goal-amount" className="text-sm">Goal Amount</Label>
          <Input
            id="goal-amount"
            type="number"
            placeholder="0.00"
            value={goalForm.amount}
            onChange={(e) =>
              setGoalForm({ ...goalForm, amount: e.target.value })
            }
            className="text-sm"
          />
        </div>

        {/* Monthly Contribution */}
        <div>
          <Label htmlFor="goal-monthly-contribution" className="text-sm">
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
            className="text-sm"
          />
        </div>

        {/* Priority */}
        <div>
          <Label htmlFor="goal-priority" className="text-sm">Priority</Label>
          <Select
            value={goalForm.priority || "medium"}
            onValueChange={(value) =>
              setGoalForm({ ...goalForm, priority: value })
            }
          >
            <SelectTrigger id="goal-priority" className="text-sm">
              <SelectValue placeholder="Select priority" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high" className="text-sm">High</SelectItem>
              <SelectItem value="medium" className="text-sm">Medium</SelectItem>
              <SelectItem value="low" className="text-sm">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Target Date and Notes on the same row */}
        <div>
          <Label htmlFor="goal-target-date" className="text-sm">Goal Date</Label>
          <CalendarPopover
            open={targetDatePickerOpen}
            onOpenChange={setTargetDatePickerOpen}
            align="start"
            trigger={
              <button
                id="goal-target-date"
                type="button"
                className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
              >
                {goalForm.targetDate ? (
                  format(goalForm.targetDate, "PP")
                ) : (
                  <span className="text-sm">Pick a target date</span>
                )}
                <CalendarIcon className="h-4 w-4 opacity-50" />
              </button>
            }
          >
            <Calendar
              mode="single"
              selected={goalForm.targetDate}
              onSelect={(d) => {
                setGoalForm({ ...goalForm, targetDate: d || new Date() });
                if (d) setTargetDatePickerOpen(false);
              }}
              initialFocus
            />
          </CalendarPopover>
        </div>

        {/* Description Field */}
        <div className="w-full">
          <Label htmlFor="goal-description" className="text-sm">Note (Optional)</Label>
          <ExpandableTextarea
            id="goal-description"
            value={goalForm.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGoalForm({ ...goalForm, description: e.target.value })}
            placeholder="Add additional details"
            className="mt-1"
          />
        </div>
      </div>

      {/* Receipt Upload - Full Width with new styling */}
      <div>
        <Label htmlFor="goal-receipt" className="text-sm">Attach Doc (Optional)</Label>
        <div className="mt-1">
          <Input
            id="goal-receipt"
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <label
            htmlFor="goal-receipt"
            className="flex flex-col items-center justify-center w-full h-32 px-4 py-6 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-sm"
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
                <p className="text-sm text-teal-600 mt-2">
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
