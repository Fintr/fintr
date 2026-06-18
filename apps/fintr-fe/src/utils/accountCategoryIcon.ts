import {
  Building2,
  CreditCard,
  DollarSign,
  PiggyBank,
  Smartphone,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export function getAccountCategoryIcon(category: string): LucideIcon {
  switch (category.toLowerCase()) {
    case "cash":
      return Wallet;
    case "bank":
      return Building2;
    case "debit":
    case "credit_card":
      return CreditCard;
    case "e_wallet":
      return Smartphone;
    case "investment":
      return TrendingUp;
    case "loan":
      return DollarSign;
    case "savings":
      return PiggyBank;
    default:
      return Wallet;
  }
}
