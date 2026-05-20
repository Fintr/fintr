# frozen_string_literal: true

require "rails_helper"

RSpec.describe Budgets::Operations::ValidateCategoryBudgetAllocation do
  subject(:operation) { described_class.new }

  let(:space) { create(:personal_space) }
  let(:month_date) { Date.new(2025, 5, 15) }
  let!(:parent) { create(:category, :expense, space:, name: "Food") }
  let!(:sub) { create(:category, :expense, space:, name: "Groceries", parent:) }

  it "allows a parent budget above existing sub allocations" do
    create(
      :budget,
      space:,
      category: parent,
      subcategory_id: sub.id,
      date: month_date,
      amount_cents: 20_000
    )

    result = operation.call(
      space_id: space.id,
      category_id: parent.id,
      subcategory_id: nil,
      date: month_date,
      amount: 500
    )

    expect(result).to be_success
  end

  it "rejects a parent budget below sub allocations" do
    create(
      :budget,
      space:,
      category: parent,
      subcategory_id: sub.id,
      date: month_date,
      amount_cents: 50_000
    )

    result = operation.call(
      space_id: space.id,
      category_id: parent.id,
      subcategory_id: nil,
      date: month_date,
      amount: 100
    )

    expect(result).to be_failure
    expect(result.failure[:allocation_exceeded]).to be_present
  end

  it "rejects a sub budget that exceeds the parent cap" do
    create(
      :budget,
      space:,
      category: parent,
      subcategory_id: nil,
      date: month_date,
      amount_cents: 30_000
    )

    result = operation.call(
      space_id: space.id,
      category_id: parent.id,
      subcategory_id: sub.id,
      date: month_date,
      amount: 400
    )

    expect(result).to be_failure
  end
end
