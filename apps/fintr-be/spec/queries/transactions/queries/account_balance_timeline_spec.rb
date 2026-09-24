# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Queries::AccountBalanceTimeline, type: :query do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:account) do
    create(
      :account,
      space:,
      name: "Cash",
      balance: Money.from_amount(1_000, "PHP"),
    )
  end
  let(:income_category) do
    create(:category, space:, name: "Salary", category_type: "income")
  end
  let(:expense_category) do
    create(:category, space:, name: "Food", category_type: "expense")
  end

  def record_income(date:, amount:)
    income = create(
      :income_transaction,
      user:,
      space:,
      account:,
      category: income_category,
      amount: Money.from_amount(amount, "PHP"),
      date:,
    )
    Transactions::Operations::Accounts::CalculateBalance.new.call(transaction_id: income.id)
    income
  end

  def record_expense(date:, amount:)
    expense = create(
      :expense_transaction,
      user:,
      space:,
      account:,
      category: expense_category,
      amount: Money.from_amount(amount, "PHP"),
      date:,
    )
    Transactions::Operations::Accounts::CalculateBalance.new.call(transaction_id: expense.id)
    expense
  end

  describe "#validate" do
    it "fails when account_id is missing" do
      result = described_class.call(
        params: {
          space_id: space.id,
          start_date: Date.new(2026, 1, 1),
          end_date: Date.new(2026, 1, 31),
        },
      )

      expect(result).to be_failure
    end

    it "fails when the account is not found" do
      result = described_class.call(
        params: {
          account_id: SecureRandom.uuid,
          space_id: space.id,
          start_date: Date.new(2026, 1, 1),
          end_date: Date.new(2026, 1, 31),
        },
      )

      expect(result.failure).to eq(account_id: "not found")
    end
  end

  describe "#call" do
    context "when the account has no activity before start_date" do
      it "starts points on the first activity date" do
        record_income(date: Date.new(2026, 1, 10), amount: 500)
        record_expense(date: Date.new(2026, 1, 15), amount: 200)

        result = described_class.call(
          params: {
            account_id: account.id,
            space_id: space.id,
            start_date: Date.new(2005, 8, 3),
            end_date: Date.new(2026, 8, 17),
          },
        )

        expect(result.value![:points].first[:date]).to eq("2026-01-10")
      end
    end

    context "when the account has activity before start_date" do
      it "includes an opening point on start_date" do
        record_income(date: Date.new(2024, 12, 1), amount: 800)
        record_income(date: Date.new(2025, 1, 10), amount: 200)

        result = described_class.call(
          params: {
            account_id: account.id,
            space_id: space.id,
            start_date: Date.new(2025, 1, 1),
            end_date: Date.new(2025, 1, 31),
          },
        )

        expect(result.value![:points].first[:date]).to eq("2025-01-01")
      end
    end
  end
end
