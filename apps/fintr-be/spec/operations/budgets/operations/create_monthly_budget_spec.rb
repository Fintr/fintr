# frozen_string_literal: true

require "rails_helper"

RSpec.describe Budgets::Operations::CreateMonthlyBudget do
  subject(:call_operation) { described_class.new.call(params) }

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:previous_month_date) { Date.new(2026, 5, 15) }
  let(:next_month_date) { Date.new(2026, 6, 1) }
  let(:params) do
    {
      space_id: space.id,
      date: next_month_date
    }
  end

  let!(:parent_category) do
    create(:category, :expense, space:, name: "Food")
  end

  let!(:subcategory) do
    create(:category, :expense, space:, name: "Groceries", parent: parent_category)
  end

  describe "#call" do
    context "when copying budgets from the previous month into the next month" do
      let!(:parent_budget) do
        create(
          :budget,
          space:,
          category: parent_category,
          subcategory_id: nil,
          date: previous_month_date,
          amount_cents: 50_000,
          amount_currency: "PHP"
        )
      end

      let!(:subcategory_budget) do
        create(
          :budget,
          space:,
          category: parent_category,
          subcategory_id: subcategory.id,
          date: previous_month_date,
          amount_cents: 20_000,
          amount_currency: "PHP"
        )
      end

      it { is_expected.to be_success }

      it "creates parent and subcategory budgets for the target month" do
        expect { call_operation }.to change(Budget, :count).by(2)
      end

      it "copies parent budget amounts and dates" do
        call_operation

        copied_parent = space.budgets.for_month(next_month_date).find_by(subcategory_id: nil)
        expect(copied_parent.category_id).to eq(parent_category.id)
        expect(copied_parent.amount_cents).to eq(50_000)
        expect(copied_parent.date).to eq(next_month_date)
      end

      it "copies subcategory budgets with subcategory_id preserved" do
        call_operation

        copied_sub = space.budgets.for_month(next_month_date).find_by(subcategory_id: subcategory.id)
        expect(copied_sub.category_id).to eq(parent_category.id)
        expect(copied_sub.subcategory_id).to eq(subcategory.id)
        expect(copied_sub.amount_cents).to eq(20_000)
        expect(copied_sub.date).to eq(next_month_date)
      end

      it "does not duplicate previous-month budgets" do
        call_operation

        expect(space.budgets.for_month(previous_month_date).count).to eq(2)
      end
    end

    context "when the target month already has budgets" do
      before do
        create(
          :budget,
          space:,
          category: parent_category,
          date: next_month_date,
          amount_cents: 10_000
        )
      end

      it { is_expected.to be_failure }

      it "returns an already-created failure message" do
        expect(call_operation.failure).to eq(
          budgets: "Already created for the month of June 2026"
        )
      end

      it "does not create additional budgets" do
        create(
          :budget,
          space:,
          category: parent_category,
          subcategory_id: subcategory.id,
          date: previous_month_date,
          amount_cents: 20_000
        )

        expect { call_operation }.not_to change(Budget, :count)
      end
    end

    context "when the previous month has no budgets" do
      it { is_expected.to be_success }

      it "does not create budgets for the target month" do
        expect { call_operation }.not_to change(Budget, :count)
      end
    end

    context "when the space does not exist" do
      let(:params) do
        {
          space_id: SecureRandom.uuid,
          date: next_month_date
        }
      end

      it { is_expected.to be_failure }

      it "returns a space not found error" do
        expect(call_operation.failure).to eq(space_id: "not found")
      end
    end

    context "with invalid params" do
      let(:params) { { date: next_month_date } }

      it { is_expected.to be_failure }

      it "returns contract validation errors" do
        expect(call_operation.failure).to eq(
          errors: { space_id: ["is missing"] }
        )
      end
    end
  end
end
