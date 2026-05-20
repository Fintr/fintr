# frozen_string_literal: true

require "rails_helper"

RSpec.describe "category assignment on transactions", type: :model do
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space:) }
  let!(:parent) { create(:category, :expense, space:, name: "Travel") }
  let!(:sub) { create(:category, :expense, space:, name: "Flights", parent:) }
  let!(:other_parent) { create(:category, :expense, space:, name: "Food") }

  it "allows a subcategory that belongs to the parent category" do
    transaction = build(
      :expense_transaction,
      space:,
      account:,
      category: parent,
      subcategory: sub,
    )

    expect(transaction).to be_valid
  end

  it "rejects a subcategory that is not a child of the category" do
    transaction = build(
      :expense_transaction,
      space:,
      account:,
      category: other_parent,
      subcategory: sub,
    )

    expect(transaction).not_to be_valid
    expect(transaction.errors[:subcategory_id]).to include(
      "must belong to the selected parent category"
    )
  end
end
