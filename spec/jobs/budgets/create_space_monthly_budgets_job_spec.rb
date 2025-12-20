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
          date: Utils::Dates.current_date_in_manila
        )
        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space2.id,
          date: Utils::Dates.current_date_in_manila
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
        expected_date = Utils::Dates.current_date_in_manila

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
        expected_date = Utils::Dates.current_date_in_manila

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
        expected_date = Utils::Dates.current_date_in_manila

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
        expected_date = Utils::Dates.current_date_in_manila

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
        expected_date = Utils::Dates.current_date_in_manila

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end

      it "works consistently across different system timezones" do
        test_timezones.each do |tz|
          Time.use_zone(tz) do
            expected_date = Utils::Dates.current_date_in_manila

            expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
              space_id: space1.id,
              date: expected_date
            )

            job.perform
          end
        end
      end
    end

    context "when it is early morning in Manila (after midnight boundary)" do
      around do |example|
        # Set to 00:45 Manila time on November 1st (which would be 16:45 UTC on October 31st)
        # This tests the edge case where server is in UTC and it's past midnight in Manila
        travel_to Time.zone.parse("2024-11-01 00:45:00").in_time_zone("Asia/Manila")
        example.run
      end

      it "uses the correct date for Manila timezone even when server timezone differs" do
        # When it's 00:45 on Nov 1 in Manila, the date should be Nov 1
        # Even if server is in UTC (where it would still be Oct 31, 16:45)
        expected_date = Utils::Dates.current_date_in_manila

        expect(expected_date).to eq(Date.new(2024, 11, 1))

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end
    end

    context "when date is at month boundary with leap year" do
      around do |example|
        # Set to end of month in leap year
        travel_to Time.zone.parse("2024-02-29 23:59:59")
        example.run
      end

      it "uses Asia/Manila timezone regardless of system timezone" do
        expected_date = Utils::Dates.current_date_in_manila

        expect(Budgets::CreateMonthlyBudgetsJob).to receive(:perform_later).with(
          space_id: space1.id,
          date: expected_date
        )

        job.perform
      end

      it "works consistently across different system timezones in leap year" do
        test_timezones.each do |tz|
          Time.use_zone(tz) do
            expected_date = Utils::Dates.current_date_in_manila

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
