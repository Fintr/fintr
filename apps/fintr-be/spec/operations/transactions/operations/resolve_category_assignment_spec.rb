# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::ResolveCategoryAssignment do
  subject(:operation) { described_class.new }

  let(:space) { create(:personal_space) }
  let!(:parent) { create(:category, :expense, space:, name: "Food") }
  let!(:sub) { create(:category, :expense, space:, name: "Groceries", parent:) }

  it "returns parent-only assignment" do
    result = operation.call(
      space_id: space.id,
      category_id: parent.id,
      subcategory_id: nil
    )

    expect(result).to be_success
    expect(result.value!).to eq(
      category_id: parent.id,
      subcategory_id: nil
    )
  end

  it "returns parent and sub assignment" do
    result = operation.call(
      space_id: space.id,
      category_id: parent.id,
      subcategory_id: sub.id
    )

    expect(result).to be_success
    expect(result.value!).to eq(
      category_id: parent.id,
      subcategory_id: sub.id
    )
  end

  it "fails when subcategory does not belong to parent" do
    other_parent = create(:category, :expense, space:, name: "Transport")

    result = operation.call(
      space_id: space.id,
      category_id: other_parent.id,
      subcategory_id: sub.id
    )

    expect(result).to be_failure
    expect(result.failure[:subcategory_id]).to eq(
      "must belong to the selected parent category"
    )
  end

  it "fails when category_id is a subcategory, not a parent" do
    result = operation.call(
      space_id: space.id,
      category_id: sub.id,
      subcategory_id: nil
    )

    expect(result).to be_failure
    expect(result.failure[:category_id]).to eq("must be a parent category")
  end
end
