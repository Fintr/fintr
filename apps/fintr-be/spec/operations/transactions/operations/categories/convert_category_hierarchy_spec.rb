# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Categories::ConvertCategoryHierarchy do
  subject(:operation) { described_class.new }

  let(:space) { create(:personal_space) }
  let!(:food_parent) { create(:category, :expense, space:, name: "Food") }
  let!(:church) { create(:category, :expense, space:, name: "Church") }

  describe "to_subcategory" do
    let(:params) do
      {
        id: church.id,
        space_id: space.id,
        conversion_type: "to_subcategory",
        new_parent_id: food_parent.id
      }
    end

    it "moves the category under a parent and reassigns transactions" do
      expense = create(
        :expense_transaction,
        space:,
        category: church,
        subcategory: nil,
        amount_cents: 10_000
      )

      result = operation.call(params)

      expect(result).to be_success
      church.reload
      expect(church.parent_id).to eq(food_parent.id)

      expense.reload
      expect(expense.category_id).to eq(food_parent.id)
      expect(expense.subcategory_id).to eq(church.id)
    end

    it "returns preview totals via preview operation" do
      create(:expense_transaction, space:, category: church, subcategory: nil, amount_cents: 5_000)
      create(:income_transaction, space:, category: church, subcategory: nil, amount_cents: 2_000)

      preview = Transactions::Operations::Categories::PreviewCategoryConversion.new.call(params)

      expect(preview).to be_success
      expect(preview.value![:transaction_count]).to eq(2)
      expect(preview.value![:expense_count]).to eq(1)
      expect(preview.value![:income_count]).to eq(1)
      expect(preview.value![:expense_total]).to eq(50.0)
      expect(preview.value![:income_total]).to eq(20.0)
    end

    it "fails when category has subcategories" do
      create(:category, :expense, space:, name: "Offering", parent: church)

      result = operation.call(params)

      expect(result).to be_failure
      expect(result.failure[:category]).to include("subcategories")
    end
  end

  describe "to_parent" do
    let!(:church_sub) do
      create(:category, :expense, space:, name: "Sunday", parent: food_parent)
    end

    let(:params) do
      {
        id: church_sub.id,
        space_id: space.id,
        conversion_type: "to_parent"
      }
    end

    it "promotes a subcategory and reassigns transactions" do
      expense = create(
        :expense_transaction,
        space:,
        category: food_parent,
        subcategory: church_sub,
        amount_cents: 3_000
      )

      result = operation.call(params)

      expect(result).to be_success
      church_sub.reload
      expect(church_sub.parent_id).to be_nil

      expense.reload
      expect(expense.category_id).to eq(church_sub.id)
      expect(expense.subcategory_id).to be_nil
    end
  end
end
