import { OptionType } from "./generalTypes";

export interface DashboardData {
  id: string;
  categoryOptions: OptionType[];
  accountOptions: OptionType[];
  expenseCategoryOptions: OptionType[];
  incomeCategoryOptions: OptionType[];
  goalDescription: string;
}
