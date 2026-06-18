# frozen_string_literal: true

module Transactions
  class Combined < ApplicationRecord
    TYPE_MAPPING = {
      "Transactions::Transaction" => "transaction",
      "Transactions::Transfer" => "transfer",
      "Transactions::Expense" => "expense",
      "Transactions::Income" => "income",
      "Transactions::Loan" => "loan_disbursement",
      "Transactions::LoanPayment" => "loan_payment",
    }.freeze

    self.table_name = "combined_transactions"

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :category, class_name: "Transactions::Category", optional: true
    belongs_to :from_account, class_name: "Transactions::Account", optional: true
    belongs_to :to_account, class_name: "Transactions::Account", optional: true

    belongs_to :transactable, polymorphic: true

    monetize :amount_cents, allow_nil: false
    monetize :balance_cents, allow_nil: true
    monetize :transaction_cost_cents, allow_nil: true

    scope :non_draft, -> { where.not(transactable_type: "Transactions::Draft") }

    def readonly?
      true
    end

    def value
      transactable.value
    end

    def income
      transactable.income
    end

    def expense
      transactable.expense
    end

    def in_series?
      return false if %w[Transactions::Loan Transactions::LoanPayment].include?(transactable_type)

      transactable.in_series?
    end
  end
end
