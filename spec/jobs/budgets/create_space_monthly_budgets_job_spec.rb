# frozen_string_literal: true

require "rails_helper"

RSpec.describe Budgets::CreateSpaceMonthlyBudgetsJob, type: :job do
  let(:job) { described_class.new }
  let(:space1) { create(:space) }
  let(:space2) { create(:space) }
  let(:test_timezones) do
    [
      "Asia/Manila",
      "UTC",
      "America/New_York",
      "Europe/London"
    ]
  end

  before do
    allow(Rails.logger).to receive(:info)
    allow(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later)
  end

  describe "#perform" do
    it "logs the job start" do
      expect(Rails.logger).to receive(:info).with("Starting CreateMonthlyBudgetJob")

      job.perform
    end

    it "queues CreateMonthlyBudgetsJob for each space" do
      expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
        space_id: space1.id,
        date: Date.current.in_time_zone("Asia/Manila")
      )
      expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
        space_id: space2.id,
        date: Date.current.in_time_zone("Asia/Manila")
      )

      job.perform
    end

    context "with timezone handling" do
      around do |example|
        Time.use_zone("Asia/Manila") do
          example.run
        end
      end

      it "uses Asia/Manila timezone for date conversion" do
        expected_date = Date.current.in_time_zone("Asia/Manila")

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end
    end

    context "with different system timezone" do
      around do |example|
        Time.use_zone("UTC") do
          example.run
        end
      end

      it "still uses Asia/Manila timezone for date conversion" do
        expected_date = Date.current.in_time_zone("Asia/Manila")

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end
    end

    context "with America/New_York system timezone" do
      around do |example|
        Time.use_zone("America/New_York") do
          example.run
        end
      end

      it "still uses Asia/Manila timezone for date conversion" do
        expected_date = Date.current.in_time_zone("Asia/Manila")

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end
    end

    context "with Europe/London system timezone" do
      around do |example|
        Time.use_zone("Europe/London") do
          example.run
        end
      end

      it "still uses Asia/Manila timezone for date conversion" do
        expected_date = Date.current.in_time_zone("Asia/Manila")

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end
    end

    context "when date is at month boundary" do
      around do |example|
        # Set to end of month
        travel_to Time.zone.parse("2024-01-31 23:59:59")
        example.run
      end

      it "uses Asia/Manila timezone regardless of system timezone" do
        expected_date = Date.current.in_time_zone("Asia/Manila")

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end

      it "works consistently across different system timezones" do
        test_timezones.each do |tz|
          Time.use_zone(tz) do
            expected_date = Date.current.in_time_zone("Asia/Manila")

            expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
              space_id: space1.id,
              date: expected_date
            )

            job.perform
          end
        end
      end
    end

    context "when date is at month boundary with leap year" do
      around do |example|
        # Set to end of month in leap year
        travel_to Time.zone.parse("2024-02-29 23:59:59")
        example.run
      end

      it "uses Asia/Manila timezone regardless of system timezone" do
        expected_date = Date.current.in_time_zone("Asia/Manila")

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end

      it "works consistently across different system timezones in leap year" do
        test_timezones.each do |tz|
          Time.use_zone(tz) do
            expected_date = Date.current.in_time_zone("Asia/Manila")

            expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
              space_id: space1.id,
              date: expected_date
            )

            job.perform
          end
        end
      end
    end
  end
end
