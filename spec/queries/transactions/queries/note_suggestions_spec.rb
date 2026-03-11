# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Queries::NoteSuggestions, type: :query do
  let!(:space) { create(:personal_space, code: "test-space") }
  let!(:account) { create(:account, space:) }
  let!(:expense_category) { create(:category, name: "Food & Groceries", category_type: "expense", space:) }
  let!(:income_category) { create(:category, name: "Salary", category_type: "income", space:) }

  let!(:expense_with_note_1) do
    create(
      :expense_transaction,
      space:,
      account:,
      category: expense_category,
      description: "Robinsons grocery shopping",
      date: 3.days.ago
    )
  end

  let!(:expense_with_note_2) do
    create(
      :expense_transaction,
      space:,
      account:,
      category: expense_category,
      description: "Puregold weekly groceries",
      date: 2.days.ago
    )
  end

  let!(:expense_with_note_3) do
    create(
      :expense_transaction,
      space:,
      account:,
      category: expense_category,
      description: "Robinsons grocery shopping",
      date: 1.day.ago
    )
  end

  let!(:expense_without_note) do
    create(
      :expense_transaction,
      space:,
      account:,
      category: expense_category,
      description: nil,
      date: Date.current
    )
  end

  let!(:income_with_note) do
    create(
      :income_transaction,
      space:,
      account:,
      category: income_category,
      description: "Monthly salary",
      date: Date.current
    )
  end

  describe "#call" do
    context "with valid parameters" do
      it "returns distinct notes for a category" do
        params = {
          space_id: space.id,
          category_name: "Food & Groceries",
          transaction_type: "expense"
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!).to contain_exactly("Robinsons grocery shopping", "Puregold weekly groceries")
      end

      it "returns notes ordered by most recent first" do
        params = {
          space_id: space.id,
          category_name: "Food & Groceries",
          transaction_type: "expense"
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!.first).to eq("Robinsons grocery shopping")
      end

      it "filters by transaction type" do
        params = {
          space_id: space.id,
          category_name: "Salary",
          transaction_type: "income"
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!).to contain_exactly("Monthly salary")
      end

      it "respects the limit parameter" do
        params = {
          space_id: space.id,
          category_name: "Food & Groceries",
          transaction_type: "expense",
          limit: 1
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!.length).to eq(1)
      end

      it "returns empty array when category has no notes" do
        empty_category = create(:category, name: "Empty Category", category_type: "expense", space:)

        params = {
          space_id: space.id,
          category_name: "Empty Category",
          transaction_type: "expense"
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!).to be_empty
      end

      it "returns empty array when category does not exist" do
        params = {
          space_id: space.id,
          category_name: "Non-existent Category",
          transaction_type: "expense"
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!).to be_empty
      end
    end

    context "with search parameter" do
      it "filters notes by search term" do
        params = {
          space_id: space.id,
          category_name: "Food & Groceries",
          transaction_type: "expense",
          search: "robinsons"
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!).to contain_exactly("Robinsons grocery shopping")
      end

      it "performs case-insensitive search" do
        params = {
          space_id: space.id,
          category_name: "Food & Groceries",
          transaction_type: "expense",
          search: "PUREGOLD"
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!).to contain_exactly("Puregold weekly groceries")
      end
    end

    context "without transaction_type parameter" do
      it "returns notes from all transaction types in the category" do
        params = {
          space_id: space.id,
          category_name: "Food & Groceries"
        }

        result = described_class.call(params:)

        expect(result).to be_success
        expect(result.value!).to contain_exactly("Robinsons grocery shopping", "Puregold weekly groceries")
      end
    end
  end
end
