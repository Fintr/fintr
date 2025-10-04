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
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget, call: instance_double('Result')) # rubocop:disable RSpec/VerifiedDoubleReference
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)

        job.perform(space_id:, date:)

        expect(Budgets::Operations::CreateMonthlyBudget).to have_received(:new)
      end

      it "logs the job start" do
        expect(Rails.logger).to receive(:info).with(
          "Starting CreateMonthlyBudgetJob for space #{space_id} and date #{date}"
        )

        job.perform(space_id:, date:)
      end
    end

    context "with timezone handling" do
      let(:date) { Date.new(2024, 1, 15) }

      it "passes the date directly to the operation" do
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)

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
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)

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
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)

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
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)

        expect(mock_operation).to receive(:call).with(space_id:, date:)

        job.perform(space_id:, date:)
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
        mock_operation = instance_double(Budgets::Operations::CreateMonthlyBudget)
        allow(Budgets::Operations::CreateMonthlyBudget).to receive(:new).and_return(mock_operation)

        expect(mock_operation).to receive(:call).with(space_id:, date:)

        job.perform(space_id:, date:)
      end
    end
  end
end
