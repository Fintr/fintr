# frozen_string_literal: true

FactoryBot.define do
  factory :ai_rag_embedding, class: "Ai::RagEmbedding" do
    association :embeddable, factory: :expense_transaction
    association :space, factory: :personal_space
    content { "Transaction: Test transaction, Amount: -100.00 PHP, Category: Food, Account: Cash, Date: January 01, 2024, Type: Transactions::Expense, Space: Personal Space" }
    embedding { Array.new(1536) { rand(-1.0..1.0) } }
    metadata do
      {
        embeddable_type: "Transactions::Transaction",
        transaction_type: "Transactions::Expense",
        category: "Food",
        account: "Cash",
        amount: 100.0,
        amount_display: -100.0,
        date: Date.current.iso8601
      }
    end

    trait :for_transfer do
      association :embeddable, factory: :transfer
      content { "Transfer: Test transfer, Amount: 100.00 PHP, From Account: Cash, To Account: Bank, Transaction Cost: 0.00 PHP, Date: January 01, 2024, Type: Transfer, Space: Personal Space" }
      metadata do
        {
          embeddable_type: "Transactions::Transfer",
          from_account: "Cash",
          to_account: "Bank",
          amount: 100.0,
          transaction_cost: 0.0,
          date: Date.current.iso8601
        }
      end
    end
  end
end
