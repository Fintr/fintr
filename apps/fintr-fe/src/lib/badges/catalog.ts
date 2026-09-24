import type { LevelTitle } from "@/types/badgeTypes";

/** One unique LinkedIn-flat illustration per title/achievement image key. */
export const BADGE_IMAGE_PATHS: Record<string, string> = {
  // Level titles
  rookie_tracker: "/badges/rookie_tracker.png",
  receipt_rookie: "/badges/receipt_rookie.png",
  steady_logger: "/badges/steady_logger.png",
  fierce_budgeter: "/badges/fierce_budgeter.png",
  super_saver: "/badges/super_saver.png",
  goal_getter: "/badges/goal_getter.png",
  cashflow_captain: "/badges/cashflow_captain.png",
  ledger_legend: "/badges/ledger_legend.png",
  wealth_weaver: "/badges/wealth_weaver.png",
  money_maestro: "/badges/money_maestro.png",
  // Collectibles — transactions
  penny_pioneer: "/badges/penny_pioneer.png",
  habit_hacker: "/badges/habit_hacker.png",
  ledger_climber: "/badges/ledger_climber.png",
  fifty_strong: "/badges/fifty_strong.png",
  century_chronicler: "/badges/century_chronicler.png",
  double_century: "/badges/double_century.png",
  triple_tracker: "/badges/triple_tracker.png",
  half_grand_historian: "/badges/half_grand_historian.png",
  thousand_tales: "/badges/thousand_tales.png",
  // Collectibles — budgets / invites
  budget_beast: "/badges/budget_beast.png",
  crew_caller: "/badges/crew_caller.png",
  // Collectibles — loans
  first_lien: "/badges/first_lien.png",
  loan_stacker: "/badges/loan_stacker.png",
  debt_dynamo: "/badges/debt_dynamo.png",
  // Collectibles — loan payments
  payback_starter: "/badges/payback_starter.png",
  installment_ace: "/badges/installment_ace.png",
  repayment_pro: "/badges/repayment_pro.png",
  // Collectibles — transfers
  hop_starter: "/badges/hop_starter.png",
  account_hopper: "/badges/account_hopper.png",
  transfer_titan: "/badges/transfer_titan.png",
  wire_wizard: "/badges/wire_wizard.png",
};

export const badgeImageForKey = (imageKey: string): string => {
  return BADGE_IMAGE_PATHS[imageKey] ?? "/badges/rookie_tracker.png";
};

export const FALLBACK_TITLE: LevelTitle = {
  level: 1,
  key: "rookie_tracker",
  title: "Rookie Tracker",
  description: "You opened the books. Every legend starts here.",
  imageKey: "rookie_tracker",
  unlocked: true,
};
