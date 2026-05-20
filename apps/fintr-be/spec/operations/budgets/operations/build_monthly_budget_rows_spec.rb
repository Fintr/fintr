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
end
