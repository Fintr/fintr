# frozen_string_literal: true

require "rails_helper"

RSpec.describe Budgets::Operations::BuildMonthlyBudgetRows do
  subject(:operation) { described_class.new }

  let(:space) { create(:personal_space) }
  let!(:parent) { create(:category, :expense, space:, name: "Food") }
  let!(:sub) { create(:category, :expense, space:, name: "Groceries", parent:) }
  let(:start_date) { Date.new(2025, 5, 1) }
  let(:end_date) { Date.new(2025, 5, 31) }

  it "rolls parent spent up across all subcategory transactions" do
    account = create(:account, space:)
    create(
      :expense_transaction,
      space:,
      account:,
      category: parent,
      subcategory_id: sub.id,
      date: Date.new(2025, 5, 10),
      amount: 50,
      balance_state: :calculated
    )

    parent_budget = create(
      :budget,
      space:,
      category: parent,
      date: Date.new(2025, 5, 1),
      amount_cents: 100_00
    )

    result = operation.call(
      budgets: [parent_budget],
      space_id: space.id,
      start_date:,
      end_date:
    )

    expect(result).to be_success
    expect(result.value!.first[:total_spent]).to eq(50)
    expect(result.value!.first[:amount]).to eq(100)
    expect(result.value!.first[:subcategory_id]).to be_nil
    expect(result.value!.first[:has_explicit_parent_budget]).to be(true)
  end

  it "exposes subcategory rows with category and subcategory ids" do
    sub_budget = create(
      :budget,
      space:,
      category: parent,
      subcategory: sub,
      date: Date.new(2025, 5, 1),
      amount_cents: 25_00
    )

    result = operation.call(
      budgets: [sub_budget],
      space_id: space.id,
      start_date:,
      end_date:
    )

    row = result.value!.first
    sub_row = row[:subcategories].first

    expect(row[:amount]).to eq(25)
    expect(row[:subcategory_id]).to be_nil
    expect(row[:has_explicit_parent_budget]).to be(false)
    expect(sub_row[:subcategory_id]).to eq(sub.id)
    expect(sub_row[:category_id]).to eq(parent.id)
    expect(sub_row[:amount]).to eq(25)
  end

  it "exposes parent_only_spent for transactions without a subcategory" do
    account = create(:account, space:)
    create(
      :expense_transaction,
      space:,
      account:,
      category: parent,
      subcategory_id: nil,
      date: Date.new(2025, 5, 5),
      amount: 30,
      balance_state: :calculated
    )
    create(
      :expense_transaction,
      space:,
      account:,
      category: parent,
      subcategory_id: sub.id,
      date: Date.new(2025, 5, 10),
      amount: 20,
      balance_state: :calculated
    )

    parent_budget = create(
      :budget,
      space:,
      category: parent,
      date: Date.new(2025, 5, 1),
      amount_cents: 100_00
    )
    sub_budget = create(
      :budget,
      space:,
      category: parent,
      subcategory: sub,
      date: Date.new(2025, 5, 1),
      amount_cents: 25_00
    )

    result = operation.call(
      budgets: [parent_budget, sub_budget],
      space_id: space.id,
      start_date:,
      end_date:
    )

    row = result.value!.first

    expect(row[:total_spent]).to eq(50)
    expect(row[:parent_only_spent]).to eq(30)
    expect(row[:subcategories].first[:spent]).to eq(20)
  end

  it "includes subcategory spending when no subcategory budget exists" do
    account = create(:account, space:)
    create(
      :expense_transaction,
      space:,
      account:,
      category: parent,
      subcategory_id: sub.id,
      date: Date.new(2025, 5, 10),
      amount: 45,
      balance_state: :calculated
    )

    parent_budget = create(
      :budget,
      space:,
      category: parent,
      date: Date.new(2025, 5, 1),
      amount_cents: 100_00
    )

    result = operation.call(
      budgets: [parent_budget],
      space_id: space.id,
      start_date:,
      end_date:
    )

    row = result.value!.first
    sub_row = row[:subcategories].find { |entry| entry[:subcategory_id] == sub.id }

    expect(sub_row).to be_present
    expect(sub_row[:id]).to be_nil
    expect(sub_row[:spent]).to eq(45)
    expect(sub_row[:budget]).to eq(0)
  end

  it "includes expenses in categories that have no budget in the spent total" do
    transport = create(:category, :expense, space:, name: "Transport")
    account = create(:account, space:)
    create(
      :expense_transaction,
      space:,
      account:,
      category: parent,
      date: Date.new(2025, 5, 4),
      amount: 50,
      balance_state: :calculated
    )
    create(
      :expense_transaction,
      space:,
      account:,
      category: transport,
      date: Date.new(2025, 5, 6),
      amount: 25,
      balance_state: :calculated
    )
    parent_budget = create(
      :budget,
      space:,
      category: parent,
      date: Date.new(2025, 5, 1),
      amount_cents: 100_00
    )

    result = operation.call(
      budgets: [parent_budget],
      space_id: space.id,
      start_date:,
      end_date:
    )
    rows = result.value!
    expense_total = MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange.call(
      space:,
      start_date:,
      end_date:
    )[:total_expenses]

    expect(rows.sum { |row| row[:total_spent].to_d }).to eq(expense_total)
    expect(rows.find { |row| row[:category_id] == transport.id }[:total_spent]).to eq(25)
    expect(rows.find { |row| row[:category_id] == transport.id }[:amount]).to eq(0)
  end

  context "when expenses are booked in a foreign currency" do
    let(:account) { create(:account, space:) }
    let(:expense_date) { Date.new(2025, 5, 10) }
    let!(:parent_budget) do
      create(
        :budget,
        space:,
        category: parent,
        date: Date.new(2025, 5, 1),
        amount_cents: 100_00
      )
    end

    before do
      ExchangeRates::ApiExchangeRate.create!(
        base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
        target_currency: "PHP",
        rate: 56.25,
        rate_date: expense_date
      )
      create(
        :expense_transaction,
        space:,
        account:,
        category: parent,
        subcategory_id: sub.id,
        date: expense_date,
        amount: 100,
        amount_currency: "USD",
        balance_state: :calculated
      )
      create(
        :expense_transaction,
        space:,
        account:,
        category: parent,
        date: expense_date,
        amount: 10,
        amount_currency: "PHP",
        balance_state: :calculated
      )
    end

    subject(:row) do
      operation.call(
        budgets: [parent_budget],
        space_id: space.id,
        start_date:,
        end_date:
      ).value!.first
    end

    it "converts the foreign expense into the space currency before totaling spent" do
      expect(row[:total_spent]).to eq(5635)
    end

    it "converts subcategory spending into the space currency" do
      sub_row = row[:subcategories].find { |entry| entry[:subcategory_id] == sub.id }

      expect(sub_row[:spent]).to eq(5625)
    end
  end

  context "when no cached rate exists for a foreign expense" do
    let(:account) { create(:account, space:) }

    it "omits that expense from spent instead of counting the raw foreign amount" do
      create(
        :expense_transaction,
        space:,
        account:,
        category: parent,
        date: Date.new(2025, 5, 10),
        amount: 100,
        amount_currency: "USD",
        balance_state: :calculated
      )
      parent_budget = create(
        :budget,
        space:,
        category: parent,
        date: Date.new(2025, 5, 1),
        amount_cents: 100_00
      )

      result = operation.call(
        budgets: [parent_budget],
        space_id: space.id,
        start_date:,
        end_date:
      )

      expect(result.value!.first[:total_spent]).to eq(0)
    end
  end
end
