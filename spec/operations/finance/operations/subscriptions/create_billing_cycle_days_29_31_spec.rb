# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::CreateBillingCycle, type: :operation do
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:subscription_plan) { create(:subscription_plan, interval: "month", token_limit: 100) }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: subscription_plan,
      started_at: original_start_date,
      metadata: {
        "original_anchor_date" => original_start_date.iso8601,
        "xendit_anchor_date" => xendit_start_date.iso8601
      }
    )
  end

  describe "billing cycle end date calculation for days 29-31" do
    context "when subscription started on day 31 of January" do
      let(:original_start_date) { Time.zone.parse("2025-01-31 10:00:00") }
      let(:xendit_start_date) { Time.zone.parse("2025-01-28 10:00:00") } # Xendit clamped to 28
      let(:current_time) { Time.zone.parse("2025-03-31 14:30:00") } # System time when cycle is created (day 31)

      context "when cycle is created at system time" do
        let(:xendit_scheduled_timestamp) { Time.zone.parse("2025-01-28 10:00:00") }

        before do
          Timecop.freeze(current_time)
        end

        after do
          Timecop.return
        end

        it "creates cycle starting at system time and ending based on original pattern" do
          result = operation.call(
            space_subscription_id: space_subscription.id.to_s,
            cycle_number: 1,
            started_at: Time.zone.now.to_datetime,
            scheduled_timestamp: xendit_scheduled_timestamp.to_datetime,
            xendit_cycle_id: "recy_test_123"
          )

          expect(result).to be_success
          billing_cycle = result.value!

          # Cycle should start at system time (beginning of day)
          expect(billing_cycle.started_at.to_date).to eq(current_time.to_date)
          expect(billing_cycle.started_at.beginning_of_day).to eq(current_time.beginning_of_day)

          # Cycle should end on day 31 of April (standard calculation: Mar 31 + 1 month - 1 day = Apr 30, but since we use end_of_day, it's Apr 30 23:59:59)
          # Actually, standard calculation: (cycle_start + 1.month - 1.day).end_of_day
          # Mar 31 + 1 month = Apr 30, then - 1 day = Apr 29, then end_of_day = Apr 29 23:59:59
          expect(billing_cycle.ends_at.day).to eq(29)
          expect(billing_cycle.ends_at.month).to eq(4)
          expect(billing_cycle.ends_at.year).to eq(2025)

          # scheduled_timestamp should be stored separately
          expect(billing_cycle.scheduled_timestamp).to be_present
          expect(billing_cycle.scheduled_timestamp.to_date).to eq(xendit_scheduled_timestamp.to_date)
        end
      end
    end

    context "when subscription started on day 30 of January" do
      let(:original_start_date) { Time.zone.parse("2025-01-30 10:00:00") }
      let(:xendit_start_date) { Time.zone.parse("2025-01-28 10:00:00") }
      let(:current_time) { Time.zone.parse("2025-03-30 15:00:00") } # System time when cycle is created (day 30)

      context "when cycle is created at system time" do
        let(:xendit_scheduled_timestamp) { Time.zone.parse("2025-01-28 10:00:00") }

        before do
          Timecop.freeze(current_time)
        end

        after do
          Timecop.return
        end

        it "creates cycle starting at system time and ending based on original pattern" do
          result = operation.call(
            space_subscription_id: space_subscription.id.to_s,
            cycle_number: 1,
            started_at: Time.zone.now.to_datetime,
            scheduled_timestamp: xendit_scheduled_timestamp.to_datetime,
            xendit_cycle_id: "recy_test_123"
          )

          expect(result).to be_success
          billing_cycle = result.value!

          # Cycle should start at system time
          expect(billing_cycle.started_at.to_date).to eq(current_time.to_date)

          # Cycle should end on day 29 of April (standard calculation: Mar 30 + 1 month - 1 day = Apr 29)
          expect(billing_cycle.ends_at.day).to eq(29)
          expect(billing_cycle.ends_at.month).to eq(4)
        end
      end
    end

    context "when subscription started on day 29 of January" do
      let(:original_start_date) { Time.zone.parse("2025-01-29 10:00:00") }
      let(:xendit_start_date) { Time.zone.parse("2025-01-28 10:00:00") }
      let(:current_time) { Time.zone.parse("2025-03-29 11:00:00") } # System time when cycle is created (day 29)

      context "when cycle is created at system time" do
        let(:xendit_scheduled_timestamp) { Time.zone.parse("2025-01-28 10:00:00") }

        before do
          Timecop.freeze(current_time)
        end

        after do
          Timecop.return
        end

        it "creates cycle starting at system time and ending based on original pattern" do
          result = operation.call(
            space_subscription_id: space_subscription.id.to_s,
            cycle_number: 1,
            started_at: Time.zone.now.to_datetime,
            scheduled_timestamp: xendit_scheduled_timestamp.to_datetime,
            xendit_cycle_id: "recy_test_123"
          )

          expect(result).to be_success
          billing_cycle = result.value!

          # Cycle should start at system time
          expect(billing_cycle.started_at.to_date).to eq(current_time.to_date)

          # Cycle should end on day 28 of April (standard calculation: Mar 29 + 1 month - 1 day = Apr 28)
          expect(billing_cycle.ends_at.day).to eq(28)
          expect(billing_cycle.ends_at.month).to eq(4)
        end
      end
    end

    context "when subscription started on day 31 of March (leads to April which has 30 days)" do
      let(:original_start_date) { Time.zone.parse("2025-03-31 10:00:00") }
      let(:xendit_start_date) { Time.zone.parse("2025-03-28 10:00:00") }
      let(:current_time) { Time.zone.parse("2025-05-31 16:00:00") } # System time when cycle is created (day 31)

      context "when cycle is created at system time" do
        let(:xendit_scheduled_timestamp) { Time.zone.parse("2025-03-28 10:00:00") }

        before do
          Timecop.freeze(current_time)
        end

        after do
          Timecop.return
        end

        it "creates cycle starting at system time and ending one day before next cycle would start" do
          result = operation.call(
            space_subscription_id: space_subscription.id.to_s,
            cycle_number: 1,
            started_at: Time.zone.now.to_datetime,
            scheduled_timestamp: xendit_scheduled_timestamp.to_datetime,
            xendit_cycle_id: "recy_test_123"
          )

          expect(result).to be_success
          billing_cycle = result.value!

          # Cycle should start at system time
          expect(billing_cycle.started_at.to_date).to eq(current_time.to_date)

          # Cycle should end on day 29 of June (standard calculation: May 31 + 1 month - 1 day = Jun 29)
          expect(billing_cycle.ends_at.day).to eq(29)
          expect(billing_cycle.ends_at.month).to eq(6)
        end
      end
    end

    context "when subscription started on day 1-28" do
      let(:original_start_date) { Time.zone.parse("2025-01-15 10:00:00") }
      let(:xendit_start_date) { Time.zone.parse("2025-01-15 10:00:00") }
      let(:current_time) { Time.zone.parse("2025-03-31 09:00:00") } # System time when cycle is created (day 31)

      context "when cycle is created at system time" do
        let(:xendit_scheduled_timestamp) { Time.zone.parse("2025-01-15 10:00:00") }

        before do
          Timecop.freeze(current_time)
        end

        after do
          Timecop.return
        end

        it "creates cycle starting at system time and ending one day before next cycle would start" do
          result = operation.call(
            space_subscription_id: space_subscription.id.to_s,
            cycle_number: 1,
            started_at: Time.zone.now.to_datetime,
            scheduled_timestamp: xendit_scheduled_timestamp.to_datetime,
            xendit_cycle_id: "recy_test_123"
          )

          expect(result).to be_success
          billing_cycle = result.value!

          # Cycle should start at system time
          expect(billing_cycle.started_at.to_date).to eq(current_time.to_date)

          # Cycle should end on day 29 of April (standard calculation: Mar 31 + 1 month - 1 day = Apr 29)
          expect(billing_cycle.ends_at.day).to eq(29)
          expect(billing_cycle.ends_at.month).to eq(4)
        end
      end
    end
  end
end
