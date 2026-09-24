export interface ProFeature {
  key: string;
  name: string;
  description: string;
  available: boolean;
}

export const PRO_TRIAL_DAYS = 7;

export const PRO_FEATURES: ProFeature[] = [
  {
    key: "dashboard_insights",
    name: "Dashboard Insights",
    description: "Insights, Financial Health Score, expense breakdown, and weekly spending.",
    available: true,
  },
  {
    key: "ai_receipt_scanning",
    name: "AI receipt scanning",
    description: "Scan a receipt and record the transaction.",
    available: true,
  },
  {
    key: "ai_chat",
    name: "AI chat",
    description: "Ask questions about your money. 30 chats per month.",
    available: true,
  },
  {
    key: "bulk_ai_receipt_scanning",
    name: "Bulk AI receipt scanning",
    description: "Scan many receipts in one pass.",
    available: false,
  },
  {
    key: "tag_images",
    name: "Tag images",
    description: "Sample styles and generated images for tags.",
    available: true,
  },
  {
    key: "split_with_people",
    name: "Split with people",
    description: "Split a bill and track what each person owes you.",
    available: true,
  },
];
