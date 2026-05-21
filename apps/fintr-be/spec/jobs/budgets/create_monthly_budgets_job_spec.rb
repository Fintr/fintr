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

    context "with valid parameters" do
      it "calls the CreateMonthlyBudget operation" do
        success_result = Dry::Monads::Success.new({})
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(success_result)

        job.perform(space_id:, date:)

        expect(Budgets::Operations::CreateMonthlyBudget).to have_received(:new)
        expect(mock_operation).to have_received(:call).with(space_id:, date:)
      end

      it "logs the job start" do
        success_result = Dry::Monads::Success.new({})
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(success_result)

        expect(Rails.logger).to receive(:info).with(
          "Starting CreateMonthlyBudgetJob for space #{space_id} and date #{date}"
        )

        job.perform(space_id:, date:)
      end
    end

    context "with timezone handling" do
      let(:date) { Date.new(2024, 1, 15) }

      it "passes the date directly to the operation" do
        success_result = Dry::Monads::Success.new({})
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(success_result)

        expect(mock_operation).to receive(:call).with(space_id:, date:)

        job.perform(space_id:, date:)
      end
    end

    context "with different timezone contexts" do
      around do |example|
        Time.use_zone("Asia/Manila") do
          example.run
        end
      end

      let(:date) { Date.new(2024, 1, 15) }

      it "handles timezone context correctly" do
        success_result = Dry::Monads::Success.new({})
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(success_result)

        expect(mock_operation).to receive(:call).with(space_id:, date:)

        job.perform(space_id:, date:)
      end
    end

    context "with UTC timezone" do
      around do |example|
        Time.use_zone("UTC") do
          example.run
        end
      end

      let(:date) { Date.new(2024, 1, 15) }

      it "handles UTC timezone correctly" do
        success_result = Dry::Monads::Success.new({})
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(success_result)

        expect(mock_operation).to receive(:call).with(space_id:, date:)

        job.perform(space_id:, date:)
      end
    end

    context "with America/New_York timezone" do
      around do |example|
        Time.use_zone("America/New_York") do
          example.run
        end
      end

      let(:date) { Date.new(2024, 1, 15) }

      it "handles Eastern timezone correctly" do
        success_result = Dry::Monads::Success.new({})
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(success_result)

        expect(mock_operation).to receive(:call).with(space_id:, date:)

        job.perform(space_id:, date:)
      end
    end

    context "with integration with CreateMonthlyBudget operation" do
      let(:space) { create(:personal_space) }
      let(:space_id) { space.id }
      let(:date) { Date.new(2026, 6, 1) }
      let!(:category) { create(:category, :expense, space:, name: "Food") }
      let!(:parent) { category }
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

        june_budgets = space.budgets.for_month(date)
        expect(june_budgets.find_by(subcategory_id: nil).amount_cents).to eq(30_000)
        expect(june_budgets.find_by(subcategory_id: subcategory.id).amount_cents).to eq(12_000)
      end

      it "raises when budgets already exist for the target month" do
        create(:budget, space:, category: parent, date:)

        expect { job.perform(space_id:, date:) }.to raise_error(StandardError, /Already created/)
      end
    end

    context "with Europe/London timezone" do
      around do |example|
        Time.use_zone("Europe/London") do
          example.run
        end
      end

      let(:date) { Date.new(2024, 1, 15) }

      it "handles London timezone correctly" do
        success_result = Dry::Monads::Success.new({})
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(success_result)

        expect(mock_operation).to receive(:call).with(space_id:, date:)

        job.perform(space_id:, date:)
      end
    end
  end
end
