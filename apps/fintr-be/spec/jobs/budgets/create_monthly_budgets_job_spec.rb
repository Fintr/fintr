# frozen_string_literal: true

require "rails_helper"

RSpec.describe Budgets::CreateMonthlyBudgetsJob, type: :job do
  let(:space) { create(:space) }
  let(:job) { described_class.new }

  before do
    allow(Rails.logger).to receive(:info)
  end

  describe "#perform" do
    let(:space_id) { space.id }
    let(:date) { Date.current }

    it "calls the CreateMonthlyBudget operation" do
      success_result = Dry::Monads::Success.new({})
      mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
      allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
      allow(mock_operation).to receive(:call).and_return(success_result)

      job.perform(space_id:, date:)

      expect(Budgets::Operations::CreateMonthlyBudget).to have_received(:new)
    end

    it "passes space_id and date to the operation" do
      success_result = Dry::Monads::Success.new({})
      mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
      allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
      allow(mock_operation).to receive(:call).and_return(success_result)

      job.perform(space_id:, date:)

      expect(mock_operation).to have_received(:call).with(space_id:, date:)
    end

    context "with integration with CreateMonthlyBudget operation" do
      let(:space) { create(:personal_space) }
      let(:space_id) { space.id }
      let(:date) { Date.new(2026, 6, 1) }
      let!(:parent) { create(:category, :expense, space:, name: "Food") }
      let!(:subcategory) do
        create(:category, :expense, space:, name: "Groceries", parent:)
      end

      before do
        create(
          :budget,
          space:,
          category: parent,
          subcategory_id: nil,
          date: Date.new(2026, 5, 10),
          amount_cents: 30_000
        )
        create(
          :budget,
          space:,
          category: parent,
          subcategory_id: subcategory.id,
          date: Date.new(2026, 5, 10),
          amount_cents: 12_000
        )
      end

      it "creates next-month parent and subcategory budgets from the prior month" do
        expect { job.perform(space_id:, date:) }.to change(Budget, :count).by(2)
      end

      it "copies missing previous-month budgets when the target month already has some" do
        create(:budget, space:, category: parent, date:)

        expect { job.perform(space_id:, date:) }.to change(Budget, :count).by(1)
      end
    end
  end
end
