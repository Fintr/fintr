import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Progress } from "../ui/progress";
import { format } from "date-fns";
import { Plus, Target, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface GoalSectionProps {
  formatCurrency: (amount: number) => string;
}

const GoalSection = ({ formatCurrency }: GoalSectionProps) => {
  const [open, setOpen] = useState(false);
  const [goalType, setGoalType] = useState("short-term");
  const [editingGoalIndex, setEditingGoalIndex] = useState<number | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalTargetAmount, setGoalTargetAmount] = useState("");
  const [goalCurrentAmount, setGoalCurrentAmount] = useState("");
  const [goalMonthlyContribution, setGoalMonthlyContribution] = useState("");
  const [goalPriority, setGoalPriority] = useState("medium");
  const [goalNotes, setGoalNotes] = useState("");
  const [financialFreedomDefinition, setFinancialFreedomDefinition] = useState(
    "Having enough passive income to cover my expenses and being able to travel 3 months a year."
  );

  // Mock goals data with state
  const [goals, setGoals] = useState([
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
  ]);

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600";
      case "medium":
        return "text-amber-600";
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 bg-[#FAF9F6]">
      <Card className="border-0 shadow-none bg-[#FAF9F6]">
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Financial Goals</CardTitle>
              <CardDescription>
                Track and manage your financial goals
              </CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
                  <Plus className="h-4 w-4 mr-2" /> Add Goal
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Financial Goal</DialogTitle>
                  <DialogDescription>
                    Set up a new financial goal to track your progress
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="goal-name">Goal Name</Label>
                      <Input
                        id="goal-name"
                        placeholder="e.g., Emergency Fund"
                        value={goalName}
                        onChange={(e) => setGoalName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-category">Category</Label>
                      <Select
                        defaultValue="emergency"
                        value={goalType}
                        onValueChange={setGoalType}
                      >
                        <SelectTrigger id="goal-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debt-payoff">
                            Debt Pay-Off
                          </SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                          <SelectItem value="retirement">Retirement</SelectItem>
                          <SelectItem value="home">Home</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="investment">Investment</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="big-purchase">
                            Big Purchase
                          </SelectItem>
                          <SelectItem value="life-milestones">
                            Life Milestones
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="target-amount">Target Amount</Label>
                      <Input
                        id="target-amount"
                        type="number"
                        placeholder="0.00"
                        value={goalTargetAmount}
                        onChange={(e) => setGoalTargetAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="current-amount">Current Amount</Label>
                      <Input
                        id="current-amount"
                        type="number"
                        placeholder="0.00"
                        value={goalCurrentAmount}
                        onChange={(e) => setGoalCurrentAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="monthly-contribution">
                        Monthly Contribution
                      </Label>
                      <Input
                        id="monthly-contribution"
                        type="number"
                        placeholder="0.00"
                        value={goalMonthlyContribution}
                        onChange={(e) =>
                          setGoalMonthlyContribution(e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-priority">Priority</Label>
                      <Select
                        defaultValue="medium"
                        value={goalPriority}
                        onValueChange={setGoalPriority}
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="goal-notes">Notes</Label>
                      <Input
                        id="goal-notes"
                        placeholder="Additional details about your goal"
                        value={goalNotes}
                        onChange={(e) => setGoalNotes(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2"></div>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      setEditingGoalIndex(null);
                      setGoalName("");
                      setGoalTargetAmount("");
                      setGoalCurrentAmount("");
                      setGoalMonthlyContribution("");
                      setGoalPriority("medium");
                      setGoalNotes("");
                    }}
                    className="mr-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#0A3D62] hover:bg-[#0A3D62]/80"
                    onClick={() => {
                      // Create a new goal object
                      const newGoal = {
                        id:
                          editingGoalIndex !== null
                            ? goals[editingGoalIndex].id
                            : goals.length + 1,
                        name: goalName || "New Goal",
                        targetAmount: parseFloat(goalTargetAmount) || 100000,
                        currentAmount: parseFloat(goalCurrentAmount) || 0,
                        targetDate: new Date().toISOString().split("T")[0],
                        category: goalType,
                        priority: goalPriority,
                        monthlyContribution:
                          parseFloat(goalMonthlyContribution) || 5000,
                        notes: goalNotes,
                      };

                      if (editingGoalIndex !== null) {
                        // Update existing goal
                        const updatedGoals = [...goals];
                        updatedGoals[editingGoalIndex] = newGoal;
                        setGoals(updatedGoals);
                      } else {
                        // Check if goal with same name exists
                        const existingGoalIndex = goals.findIndex(
                          (g) =>
                            g.name.toLowerCase() === newGoal.name.toLowerCase()
                        );

                        if (existingGoalIndex >= 0) {
                          // Update existing goal
                          const updatedGoals = [...goals];
                          updatedGoals[existingGoalIndex] = {
                            ...updatedGoals[existingGoalIndex],
                            ...newGoal,
                            id: updatedGoals[existingGoalIndex].id, // Keep original ID
                          };
                          setGoals(updatedGoals);
                        } else {
                          // Add new goal
                          setGoals([...goals, newGoal]);
                        }
                      }

                      // Reset form and close dialog
                      setOpen(false);
                      setEditingGoalIndex(null);
                      setGoalName("");
                      setGoalTargetAmount("");
                      setGoalCurrentAmount("");
                      setGoalMonthlyContribution("");
                      setGoalPriority("medium");
                      setGoalNotes("");
                    }}
                  >
                    {editingGoalIndex !== null ? "Update Goal" : "Create Goal"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 bg-white border-[#0A3D62]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                What's your own version of Financial Freedom?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="financialFreedomDefinition"></Label>
                <div className="relative">
                  <textarea
                    id="financialFreedomDefinition"
                    value={financialFreedomDefinition}
                    onChange={(e) =>
                      setFinancialFreedomDefinition(e.target.value)
                    }
                    className="w-full min-h-[60px] p-3 pr-12 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0A3D62] focus:border-transparent text-[#0A3D62]"
                    placeholder="Describe what financial freedom means to you personally"
                    rows={2}
                  />
                  <Button
                    className="absolute right-3 bottom-3 bg-[#0A3D62] hover:bg-[#0A3D62]/80 rounded-full p-2 h-8 w-8"
                    size="icon"
                    onClick={() => {
                      // This would normally save to a database
                      toast.success("Definition Updated", {
                        description:
                          "Your financial freedom definition has been updated.",
                      });
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goal Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Goals Summary</CardTitle>
              <CardDescription>
                Overview of your financial goals progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 rounded-lg border border-gray-100">
                  <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                    Total Goal Amount
                  </h4>
                  <div className="text-2xl font-bold text-[#0A3D62]">
                    {formatCurrency(
                      goals.reduce((sum, goal) => sum + goal.targetAmount, 0)
                    )}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-100">
                  <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                    Current Progress
                  </h4>
                  <div className="text-2xl font-bold text-[#0A3D62] flex items-center">
                    {formatCurrency(
                      goals.reduce((sum, goal) => sum + goal.currentAmount, 0)
                    )}
                    <span className="ml-2 text-sm font-medium text-[#0A3D62]/70">
                      (
                      {Math.round(
                        (goals.reduce(
                          (sum, goal) => sum + goal.currentAmount,
                          0
                        ) /
                          goals.reduce(
                            (sum, goal) => sum + goal.targetAmount,
                            0
                          )) *
                          100
                      )}
                      %)
                    </span>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-100">
                  <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                    Remaining
                  </h4>
                  <div className="text-2xl font-bold text-[#0A3D62]">
                    {formatCurrency(
                      goals.reduce(
                        (sum, goal) =>
                          sum + (goal.targetAmount - goal.currentAmount),
                        0
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6">
            {goals.map((goal, index) => (
              <div key={goal.id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-[#0A3D62] flex items-center">
                      <Target className="h-4 w-4 mr-2 text-[#0A3D62]" />
                      {goal.name}
                    </h3>
                    <p className="text-sm text-[#0A3D62]/70">
                      Target: {formatCurrency(goal.targetAmount)} by{" "}
                      {new Date(goal.targetDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${getPriorityColor(
                        goal.priority
                      )} bg-opacity-10`}
                    >
                      {goal.priority.charAt(0).toUpperCase() +
                        goal.priority.slice(1)}
                    </span>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#0A3D62] hover:bg-[#0A3D62]/10"
                        onClick={() => {
                          // Set editing state
                          setEditingGoalIndex(index);
                          setGoalType(goal.category);
                          setGoalName(goal.name);
                          setGoalTargetAmount(goal.targetAmount.toString());
                          setGoalCurrentAmount(goal.currentAmount.toString());
                          setGoalMonthlyContribution(
                            goal.monthlyContribution.toString()
                          );
                          setGoalPriority(goal.priority);
                          setGoalNotes(goal.notes || "");
                          setOpen(true);
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#0A3D62"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-50"
                        onClick={() => {
                          // Remove goal from the list
                          const updatedGoals = [...goals];
                          updatedGoals.splice(index, 1);
                          setGoals(updatedGoals);
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#E11D48"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
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
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-sm text-[#0A3D62]/70">
                      Monthly contribution:{" "}
                      {formatCurrency(goal.monthlyContribution)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span>
                        {formatCurrency(goal.currentAmount)} of{" "}
                        {formatCurrency(goal.targetAmount)}
                      </span>
                      <span>
                        (
                        {calculateProgress(
                          goal.currentAmount,
                          goal.targetAmount
                        )}
                        %)
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={calculateProgress(
                      goal.currentAmount,
                      goal.targetAmount
                    )}
                    className="h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoalSection;
