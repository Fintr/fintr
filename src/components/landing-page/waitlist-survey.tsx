import React, { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Checkbox } from "../ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";


interface WaitlistSurveyProps {
  onSubmit?: (data: WaitlistFormData) => Promise<boolean>;
  onBack?: () => void;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface WaitlistFormData {
  firstName: string;
  lastName: string;
  email: string;
  financialGoals: string[];
  currentTracking: string;
  challenges: string[];
  usefulFeatures: string[];
  platform: string;
  checkFrequency: string;
  premiumWillingness: string;
  concerns: string[];
  earlyAccess: string;
  stayConnected: string;
  customFinancialGoals: string;
  customChallenges: string;
  customFeatures: string;
  customConcerns: string;
  premiumAmount: string;
}

const WaitlistSurvey = ({
  onSubmit = async (data) => {
    // Mock successful submission
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return true;
  },
  onBack = () => {},
  email = "",
  firstName = "",
  lastName = "",
}: WaitlistSurveyProps) => {
  const [formData, setFormData] = useState<WaitlistFormData>({
    firstName: firstName,
    lastName: lastName,
    email: email,
    financialGoals: [],
    currentTracking: "",
    challenges: [],
    usefulFeatures: [],
    platform: "",
    checkFrequency: "",
    premiumWillingness: "",
    concerns: [],
    earlyAccess: "",
    stayConnected: "",
    customFinancialGoals: "",
    customChallenges: "",
    customFeatures: "",
    customConcerns: "",
    premiumAmount: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRadioChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (
    name: string,
    value: string,
    checked: boolean,
  ) => {
    setFormData((prev) => {
      const currentValues = [
        ...(prev[name as keyof WaitlistFormData] as string[]),
      ];
      if (checked) {
        return { ...prev, [name]: [...currentValues, value] };
      } else {
        return {
          ...prev,
          [name]: currentValues.filter((item) => item !== value),
        };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.firstName || !formData.lastName) {
      toast.error("Missing information");
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await onSubmit(formData);

      if (success) {
        setShowThankYou(true);
      } else {
        toast.error("Something went wrong");
      }
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showThankYou) {
    return (
      <div className="w-full min-h-screen overflow-x-hidden bg-[#FAF9F6]">
        <main className="py-10">
          <div className="max-w-2xl mx-auto text-center p-6 flex flex-col items-center">
            <h2 className="text-2xl font-bold text-[#0A3D62] mb-4">
              Thank You for Your Input!
            </h2>
            <p className="text-[#0A3D62]/80 mb-4">
              You're awesome! Your feedback will help us make Fintr better and
              more tailored to your needs.
            </p>
            <p className="text-[#0A3D62]/80 mb-4">
              If you're one of the first 50, keep an eye on your inbox—we'll
              email you soon with details on your exclusive early access!
            </p>
            <p className="text-[#0A3D62]/80 mb-4">
              Not one of the first 50? No worries! We still have something
              special for you. Stay tuned for updates and surprises as we get
              closer to launch.
            </p>
            <p className="text-[#0A3D62]/80 font-medium mb-8">
              Talk soon! – The Fintr Team
            </p>
            <Button
              onClick={() => (window.location.href = "/")}
              className="bg-[#0A3D62] hover:bg-[#0A3D62]/80 text-white font-medium transition-colors rounded-md px-6 py-2"
            >
              Return to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-[#FAF9F6]">
      <main className="py-10">
        <div className="max-w-2xl mx-auto p-6">
          <div className="mb-6">
            <button
              onClick={onBack}
              className="flex items-center text-[#0A3D62] hover:underline mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </button>
            <h2 className="text-2xl font-bold text-[#0A3D62] mb-2 text-center">
              Be Among the First to Try Fintr!
            </h2>
            <p className="text-[#0A3D62]/80 mb-4">
              Hey there! Thanks for visiting Fintr, an AI-powered finance
              tracker designed to help you take control of your money so you can
              achieve your own financial freedom - whatever it may be.
            </p>
            <p className="text-[#0A3D62]/80 mb-4">
              The first 50 people who join our waitlist will get free access to
              Fintr's core features before the official launch!
            </p>
            <p className="text-[#0A3D62]/80">
              We'd love your input to make Fintr even better. This quick
              2-minute survey helps us understand what you need in a finance
              tracker. Ready? Let's go!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  className="border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className="border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john.doe@example.com"
                className="border-gray-300"
                disabled={!!email}
              />
            </div>

            <div className="space-y-3">
              <Label>
                What is your primary financial goal? (Select all that apply)
              </Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="budgeting"
                    checked={formData.financialGoals.includes("budgeting")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "financialGoals",
                        "budgeting",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="budgeting">
                    Budgeting and expense tracking
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="short_term_goals"
                    checked={formData.financialGoals.includes(
                      "short_term_goals",
                    )}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "financialGoals",
                        "short_term_goals",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="short_term_goals">
                    Saving for short-term goals (e.g., travel, emergency fund)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="debt_payoff"
                    checked={formData.financialGoals.includes("debt_payoff")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "financialGoals",
                        "debt_payoff",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="debt_payoff">
                    Paying off debt (e.g., credit cards, loans)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="investing"
                    checked={formData.financialGoals.includes("investing")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "financialGoals",
                        "investing",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="investing">
                    Investing (real estate, stocks, crypto, etc.)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="wealth_growth"
                    checked={formData.financialGoals.includes("wealth_growth")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "financialGoals",
                        "wealth_growth",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="wealth_growth">
                    Growing wealth long-term (financial independence,
                    retirement)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="other_goal"
                    checked={formData.financialGoals.includes("other_goal")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "financialGoals",
                        "other_goal",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="other_goal">Other</Label>
                </div>
                {formData.financialGoals.includes("other_goal") && (
                  <Input
                    id="customFinancialGoals"
                    name="customFinancialGoals"
                    value={formData.customFinancialGoals}
                    onChange={handleChange}
                    placeholder="Please specify"
                    className="border-gray-300 mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>
                How do you currently track your finances? (Select one)
              </Label>
              <RadioGroup
                value={formData.currentTracking}
                onValueChange={(value) =>
                  handleRadioChange("currentTracking", value)
                }
              >
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="manually" id="manually" />
                  <Label htmlFor="manually">
                    Manually (notebook, Excel, Google Sheets)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="finance_app" id="finance_app" />
                  <Label htmlFor="finance_app">
                    Using a finance app (e.g., Mint, YNAB, etc.)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="banking_app" id="banking_app" />
                  <Label htmlFor="banking_app">Through my banking app</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="dont_track" id="dont_track" />
                  <Label htmlFor="dont_track">I don't track my finances</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>
                What are the biggest challenges you face in managing your
                finances? (Select all that apply)
              </Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="budget_sticking"
                    checked={formData.challenges.includes("budget_sticking")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "challenges",
                        "budget_sticking",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="budget_sticking">Sticking to a budget</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="understanding_spending"
                    checked={formData.challenges.includes(
                      "understanding_spending",
                    )}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "challenges",
                        "understanding_spending",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="understanding_spending">
                    Understanding where my money goes
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="future_planning"
                    checked={formData.challenges.includes("future_planning")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "challenges",
                        "future_planning",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="future_planning">
                    Planning for future expenses
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="debt_management"
                    checked={formData.challenges.includes("debt_management")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "challenges",
                        "debt_management",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="debt_management">
                    Managing debt and loan payments
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="investment_knowledge"
                    checked={formData.challenges.includes(
                      "investment_knowledge",
                    )}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "challenges",
                        "investment_knowledge",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="investment_knowledge">
                    Knowing how to invest wisely
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="financial_advice"
                    checked={formData.challenges.includes("financial_advice")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "challenges",
                        "financial_advice",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="financial_advice">
                    Finding reliable financial advice
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="saving_motivation"
                    checked={formData.challenges.includes("saving_motivation")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "challenges",
                        "saving_motivation",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="saving_motivation">
                    Staying motivated to save
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="other_challenge"
                    checked={formData.challenges.includes("other_challenge")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "challenges",
                        "other_challenge",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="other_challenge">Other</Label>
                </div>
                {formData.challenges.includes("other_challenge") && (
                  <Input
                    id="customChallenges"
                    name="customChallenges"
                    value={formData.customChallenges}
                    onChange={handleChange}
                    placeholder="Please specify"
                    className="border-gray-300 mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>
                Which features would be most useful to you in a finance tracker?
                (Select all that apply)
              </Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="ai_budgeting"
                    checked={formData.usefulFeatures.includes("ai_budgeting")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "usefulFeatures",
                        "ai_budgeting",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="ai_budgeting">
                    AI-powered budgeting assistance
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="auto_categorization"
                    checked={formData.usefulFeatures.includes(
                      "auto_categorization",
                    )}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "usefulFeatures",
                        "auto_categorization",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="auto_categorization">
                    Automatic expense categorization
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="investment_insights"
                    checked={formData.usefulFeatures.includes(
                      "investment_insights",
                    )}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "usefulFeatures",
                        "investment_insights",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="investment_insights">
                    Investment insights (real estate, stocks, crypto, etc.)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="loan_calculators"
                    checked={formData.usefulFeatures.includes(
                      "loan_calculators",
                    )}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "usefulFeatures",
                        "loan_calculators",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="loan_calculators">
                    Loan & mortgage calculators
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="ai_chatbot"
                    checked={formData.usefulFeatures.includes("ai_chatbot")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "usefulFeatures",
                        "ai_chatbot",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="ai_chatbot">
                    AI chatbot for financial advice & insights
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="bill_reminders"
                    checked={formData.usefulFeatures.includes("bill_reminders")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "usefulFeatures",
                        "bill_reminders",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="bill_reminders">
                    Bill reminders & recurring expense tracking
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="goal_tracker"
                    checked={formData.usefulFeatures.includes("goal_tracker")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "usefulFeatures",
                        "goal_tracker",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="goal_tracker">
                    Goal-based savings tracker
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="other_feature"
                    checked={formData.usefulFeatures.includes("other_feature")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "usefulFeatures",
                        "other_feature",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="other_feature">Other</Label>
                </div>
                {formData.usefulFeatures.includes("other_feature") && (
                  <Input
                    id="customFeatures"
                    name="customFeatures"
                    value={formData.customFeatures}
                    onChange={handleChange}
                    placeholder="Please specify"
                    className="border-gray-300 mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>
                Would you prefer a web-based platform, a mobile app, or both?
                (Select one)
              </Label>
              <RadioGroup
                value={formData.platform}
                onValueChange={(value) => handleRadioChange("platform", value)}
              >
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="web" id="web" />
                  <Label htmlFor="web">Web-based platform</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="mobile" id="mobile" />
                  <Label htmlFor="mobile">Mobile app</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="both" id="both" />
                  <Label htmlFor="both">Both</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>How often do you check your finances? (Select one)</Label>
              <RadioGroup
                value={formData.checkFrequency}
                onValueChange={(value) =>
                  handleRadioChange("checkFrequency", value)
                }
              >
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="daily" id="check_daily" />
                  <Label htmlFor="check_daily">Daily</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="weekly" id="check_weekly" />
                  <Label htmlFor="check_weekly">Weekly</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="monthly" id="check_monthly" />
                  <Label htmlFor="check_monthly">Monthly</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="rarely" id="check_rarely" />
                  <Label htmlFor="check_rarely">Rarely</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>
                Would you be willing to pay for a premium version with advanced
                AI insights? (Select one)
              </Label>
              <RadioGroup
                value={formData.premiumWillingness}
                onValueChange={(value) =>
                  handleRadioChange("premiumWillingness", value)
                }
              >
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="yes" id="premium_yes" />
                  <Label htmlFor="premium_yes">
                    Yes, if the price is reasonable
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="no" id="premium_no" />
                  <Label htmlFor="premium_no">
                    No, I prefer a free version
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="maybe" id="premium_maybe" />
                  <Label htmlFor="premium_maybe">
                    Maybe, depends on the features and pricing
                  </Label>
                </div>
              </RadioGroup>
              {formData.premiumWillingness === "maybe" && (
                <div className="mt-2">
                  <Label htmlFor="premiumAmount">
                    How much would you be willing to pay monthly?
                  </Label>
                  <Input
                    id="premiumAmount"
                    name="premiumAmount"
                    value={formData.premiumAmount}
                    onChange={handleChange}
                    placeholder="e.g., ₱100, ₱250, etc."
                    className="border-gray-300 mt-1"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>
                What concerns do you have about using a finance tracker app?
                (Select all that apply)
              </Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="data_privacy"
                    checked={formData.concerns.includes("data_privacy")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "concerns",
                        "data_privacy",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="data_privacy">Data privacy & security</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="ai_accuracy"
                    checked={formData.concerns.includes("ai_accuracy")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "concerns",
                        "ai_accuracy",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="ai_accuracy">
                    Accuracy of AI-generated insights
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="ease_of_use"
                    checked={formData.concerns.includes("ease_of_use")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "concerns",
                        "ease_of_use",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="ease_of_use">
                    Ease of use & learning curve
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="app_cost"
                    checked={formData.concerns.includes("app_cost")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "concerns",
                        "app_cost",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="app_cost">Cost of the app</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="advice_reliability"
                    checked={formData.concerns.includes("advice_reliability")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "concerns",
                        "advice_reliability",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="advice_reliability">
                    Reliability of financial advice
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    id="other_concern"
                    checked={formData.concerns.includes("other_concern")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "concerns",
                        "other_concern",
                        checked as boolean,
                      )
                    }
                    className="h-5 w-5 border-2 border-[#0A3D62] rounded-sm data-[state=checked]:bg-[#0A3D62]"
                  />
                  <Label htmlFor="other_concern">Other</Label>
                </div>
                {formData.concerns.includes("other_concern") && (
                  <Input
                    id="customConcerns"
                    name="customConcerns"
                    value={formData.customConcerns}
                    onChange={handleChange}
                    placeholder="Please specify"
                    className="border-gray-300 mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>
                Would you like early access to test the app and provide
                feedback? (Select one)
              </Label>
              <RadioGroup
                value={formData.earlyAccess}
                onValueChange={(value) =>
                  handleRadioChange("earlyAccess", value)
                }
              >
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="yes" id="early_access_yes" />
                  <Label htmlFor="early_access_yes">
                    Yes, I'd love to test it!
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="no" id="early_access_no" />
                  <Label htmlFor="early_access_no">
                    No, I'll wait for the official launch
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>
                Would you like to receive updates and an invite when we launch?
                (Select one)
              </Label>
              <RadioGroup
                value={formData.stayConnected}
                onValueChange={(value) =>
                  handleRadioChange("stayConnected", value)
                }
              >
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="yes" id="stay_connected_yes" />
                  <Label htmlFor="stay_connected_yes">
                    Yes, keep me posted!
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md mb-2 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="no" id="stay_connected_no" />
                  <Label htmlFor="stay_connected_no">
                    No, I'll check back later
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#0A3D62] hover:bg-[#0A3D62]/80 text-white font-medium transition-colors rounded-md"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default WaitlistSurvey;
