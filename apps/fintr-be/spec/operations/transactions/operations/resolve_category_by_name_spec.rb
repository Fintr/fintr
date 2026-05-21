# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::ResolveCategoryByName do
  subject(:call_operation) { described_class.new.call(params) }

  let(:space) { create(:personal_space) }
  let!(:parent) { create(:category, :expense, space:, name: "Food") }
  let!(:subcategory) do
    create(:category, :expense, space:, name: "Groceries", parent:)
  end

  describe "parent category names" do
    let(:params) do
      {
        space_id: space.id,
        category_name: "Food",
        category_type: "expense",
      }
    end

    it { is_expected.to be_success }

    it "returns the parent category assignment" do
      expect(call_operation.value!).to eq(
        category_id: parent.id,
        subcategory_id: nil
      )
    end
  end

  describe "subcategory names" do
    let(:params) do
      {
        space_id: space.id,
        category_name: "Groceries",
        category_type: "expense",
      }
    end

    it { is_expected.to be_success }

    it "returns the parent and subcategory assignment" do
      expect(call_operation.value!).to eq(
        category_id: parent.id,
        subcategory_id: subcategory.id
      )
    end
  end

  describe "when the category does not exist" do
    let(:params) do
      {
        space_id: space.id,
        category_name: "Missing",
        category_type: "expense",
      }
    end

    it { is_expected.to be_failure }

    it "returns a not found error" do
      expect(call_operation.failure).to eq(category_name: "not found")
    end
  end
end
