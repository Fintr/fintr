# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Category, type: :model do
  let(:space) { create(:personal_space) }

  describe "hierarchy validations" do
    it "allows a root category" do
      category = build(:category, :expense, space:, parent_id: nil)
      expect(category).to be_valid
    end

    it "allows a one-level subcategory" do
      parent = create(:category, :expense, space:, name: "Food")
      sub = build(:category, :expense, space:, name: "Groceries", parent:)
      expect(sub).to be_valid
    end

    it "rejects a subcategory whose parent is not a root" do
      parent = create(:category, :expense, space:, name: "Food")
      child = create(:category, :expense, space:, name: "Groceries", parent:)
      grandchild = build(:category, :expense, space:, name: "Organic", parent: child)

      expect(grandchild).not_to be_valid
      expect(grandchild.errors[:parent_id]).to be_present
    end
  end
end
