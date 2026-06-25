# frozen_string_literal: true

require "rails_helper"

RSpec.describe Insights::Queries::ExpensesByCategoryForTransactions do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user], currency: "PHP") }
  let(:account) { create(:account, space:) }
  let(:category) { create(:category, space:, name: "Groceries", category_type: "expense") }

  describe ".call" do
    subject(:totals) do
      described_class.call(
        transactions:,
        space:
      )
    end

    let!(:expense) do
      create(
        :expense_transaction,
        space:,
        user:,
        account:,
        category:,
        date: Date.new(2024, 6, 10),
        amount_cents: 100_00,
        amount_currency: "PHP",
        balance_state: :calculated
      )
    end

    let(:transactions) do
      Transactions::Transaction.where(id: expense.id)
    end

    it "returns expense totals grouped by category" do
      expect(totals).to eq("Groceries" => 100.to_d)
    end
  end
end
