# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Queries::AccountActivityTotalsByType do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let!(:account) do
    create(
      :account,
      space: space,
      name: "BDO Payables - Cash Reserve",
      balance: Money.from_amount(353.19, "PHP")
    )
  end

  let!(:initial_category) do
    Transactions::Category.find_or_create_by!(
      space: space,
      name: "Initial Balance",
      category_type: "income"
    )
  end

  let!(:initial_tx) do
    create(
      :income_transaction,
      user: user,
      space: space,
      account: account,
      category: initial_category,
      amount: Money.from_amount(353.19, "PHP"),
      balance_state: "calculated",
      date: Date.new(2026, 5, 12)
    )
  end

  let!(:food_category) do
    create(:category, space: space, name: "Food", category_type: "expense")
  end

  let!(:food_expense) do
    create(
      :expense_transaction,
      user: user,
      space: space,
      account: account,
      category: food_category,
      amount: Money.from_amount(100, "PHP"),
      balance_state: "calculated",
      date: Date.new(2026, 5, 20)
    )
  end

  let!(:transfer) do
    other_account = create(:account, space: space, name: "Savings")
    create(
      :transfer,
      space: space,
      from_account: account,
      to_account: other_account,
      date: Date.new(2026, 5, 25),
      amount_cents: 50_00
    )
  end

  let(:default_params) do
    {
      account_id: account.id,
      space_id: space.id,
      start_date: Date.new(2026, 1, 1),
      end_date: Date.new(2026, 12, 31)
    }
  end

  describe ".call" do
    it "returns zero totals when there are no matching income, expense, or transfer activities" do
      result = described_class.call(
        params: default_params.merge(
          start_date: Date.new(2025, 1, 1),
          end_date: Date.new(2025, 12, 31),
        ),
      )

      expect(result).to be_success
      expect(result.value!).to eq(income: 0.0, expense: 0.0, transfer: 0.0)
    end

    it "calculates income, expense, and transfer totals for filtered activities" do
      result = described_class.call(params: default_params)

      expect(result).to be_success
      expect(result.value![:income]).to eq(353.19)
      expect(result.value![:expense]).to eq(100.0)
      expect(result.value![:transfer]).to eq(50.0)
    end

    it "respects category filters" do
      result = described_class.call(
        params: default_params.merge(
          category_id: food_category.id,
          category_name: nil,
        ),
      )

      expect(result).to be_success
      expect(result.value!).to eq(income: 0.0, expense: 100.0, transfer: 0.0)
    end

    it "fails when account is not in space" do
      other_space = create(:personal_space)
      result = described_class.call(
        params: default_params.merge(
          account_id: account.id,
          space_id: other_space.id,
        ),
      )

      expect(result).to be_failure
      expect(result.failure).to eq(account_id: "not found")
    end
  end
end
