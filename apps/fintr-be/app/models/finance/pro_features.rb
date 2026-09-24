# frozen_string_literal: true

module Finance
  module ProFeatures
    TRIAL_DAYS = 7

    CATALOG = [
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
    ].freeze

    def self.description
      "Dashboard Insights, AI receipt scanning, AI chat, tag images, and split bills. Bulk AI receipt scanning is coming soon."
    end
  end
end
