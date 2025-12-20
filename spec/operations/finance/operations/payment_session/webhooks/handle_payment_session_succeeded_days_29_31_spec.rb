# frozen_string_literal: true

require "rails_helper"

# rubocop:disable RSpec/SpecFilePathFormat
RSpec.describe Finance::Operations::PaymentSessions::Webhooks::HandlePaymentSessionSucceeded, type: :operation do
  # rubocop:enable RSpec/SpecFilePathFormat
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:old_plan) { create(:subscription_plan, slug: "basic", token_limit: 50, price_cents: 14_900, interval: "month") }
  let(:new_plan) { create(:subscription_plan, slug: "premium", token_limit: 200, price_cents: 29_900, interval: "month") }

  describe "upgrade with proration on days 29-31" do
    context "when subscription started on day 31 of January" do
      let(:original_start_date) { Time.zone.parse("2025-01-31 10:00:00") }
      let(:xendit_start_date) { Time.zone.parse("2025-01-28 10:00:00") }
      let(:test_time) { Time.zone.parse("2025-01-20 12:00:00") } # Freeze time to mid-cycle
      let(:upgrade_requested_at) { test_time } # Upgrade requested at current time
      let(:payment_session_id) { "ps-test-123" }

      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: old_plan,
          status: "active",
          started_at: original_start_date,
          metadata: {
            "original_anchor_date" => original_start_date.iso8601,
            "xendit_anchor_date" => xendit_start_date.iso8601
          }
        )
      end

      let!(:current_cycle) do
        # Create a billing cycle that starts on day 28 (Xendit schedule) but should end on day 28 of February
        # The cycle was created with the correct end date based on original_anchor_date
        cycle_start = Time.zone.parse("2025-01-28 00:00:00")
        cycle_end = Time.zone.parse("2025-02-28 23:59:59") # February only has 28 days

        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1,
          span: (cycle_start..cycle_end),
          status: "paid",
          tokens_allocated: old_plan.token_limit,
          paid_at: cycle_start,
          xendit_cycle_id: "recy_original_123"
        )
      end

      let(:webhook_params) do
        {
          id: payment_session_id,
          status: "COMPLETED",
          amount: 150.0,
          currency: "PHP",
          payment_id: "py-#{SecureRandom.hex(8)}",
          reference_id: "ref-#{SecureRandom.hex(8)}",
          metadata: {
            subscription_id: space_subscription.id.to_s
          }
        }
      end

      before do
        travel_to(test_time)

        # Update subscription with pending_plan_change after cycle is created
        space_subscription.update!(
          metadata: space_subscription.metadata.merge(
            "pending_plan_change" => {
              "pending" => true,
              "new_plan_id" => new_plan.id.to_s,
              "old_plan_id" => old_plan.id.to_s,
              "requested_at" => upgrade_requested_at.iso8601,
              "payment_session_id" => payment_session_id,
              "action" => "upgrade",
              "current_cycle_id" => current_cycle.id,
              "proration" => {
                "prorated_amount_cents" => 10_000,
                "current_cycle_start" => current_cycle.started_at.iso8601,
                "current_cycle_end" => current_cycle.ends_at.iso8601
              }
            }
          )
        )

        # Mock Xendit client
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:update_subscription_plan).and_return({ success: true })
      end

      after do
        travel_back
      end

      it "creates prorated cycle with correct end date based on original cycle end" do
        result = operation.call(webhook_params)

        expect(result).to be_success

        # Reload to get updated data
        space_subscription.reload
        current_cycle.reload

        # Find the prorated cycle
        prorated_cycle = space_subscription.billing_cycles.find_by("metadata->>'prorated' = 'true'")
        expect(prorated_cycle).to be_present

        # Prorated cycle should end on the same date as the original cycle would have ended
        # (day 28 of February, since February only has 28 days)
        expect(prorated_cycle.ends_at.day).to eq(28)
        expect(prorated_cycle.ends_at.month).to eq(2)
        expect(prorated_cycle.ends_at.year).to eq(2025)

        # Prorated cycle should have new plan tokens
        expect(prorated_cycle.tokens_allocated).to eq(new_plan.token_limit)

        # Original cycle should be ended early
        expect(current_cycle.ends_at).to be < Time.zone.parse("2025-02-28 23:59:59")
        expect(current_cycle.ends_at).to be >= upgrade_requested_at
      end
    end

    context "when subscription started on day 30 of March (leads to April with 30 days)" do
      let(:original_start_date) { Time.zone.parse("2025-03-30 10:00:00") }
      let(:xendit_start_date) { Time.zone.parse("2025-03-28 10:00:00") }
      let(:test_time) { Time.zone.parse("2025-03-25 12:00:00") } # Freeze time to mid-cycle
      let(:upgrade_requested_at) { test_time } # Upgrade requested at current time
      let(:payment_session_id) { "ps-test-456" }

      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: old_plan,
          status: "active",
          started_at: original_start_date,
          metadata: {
            "original_anchor_date" => original_start_date.iso8601,
            "xendit_anchor_date" => xendit_start_date.iso8601
          }
        )
      end

      let!(:current_cycle) do
        # Cycle starts on day 28 (Xendit) but should end on day 30 of April
        cycle_start = Time.zone.parse("2025-03-28 00:00:00")
        cycle_end = Time.zone.parse("2025-04-30 23:59:59") # April has 30 days

        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1,
          span: (cycle_start..cycle_end),
          status: "paid",
          tokens_allocated: old_plan.token_limit,
          paid_at: cycle_start,
          xendit_cycle_id: "recy_original_456"
        )
      end

      let(:webhook_params) do
        {
          id: payment_session_id,
          status: "COMPLETED",
          amount: 150.0,
          currency: "PHP",
          payment_id: "py-#{SecureRandom.hex(8)}",
          reference_id: "ref-#{SecureRandom.hex(8)}",
          metadata: {
            subscription_id: space_subscription.id.to_s
          }
        }
      end

      before do
        travel_to(test_time)

        # Update subscription with pending_plan_change after cycle is created
        space_subscription.update!(
          metadata: space_subscription.metadata.merge(
            "pending_plan_change" => {
              "pending" => true,
              "new_plan_id" => new_plan.id.to_s,
              "old_plan_id" => old_plan.id.to_s,
              "requested_at" => upgrade_requested_at.iso8601,
              "payment_session_id" => payment_session_id,
              "action" => "upgrade",
              "current_cycle_id" => current_cycle.id,
              "proration" => {
                "prorated_amount_cents" => 10_000,
                "current_cycle_start" => current_cycle.started_at.iso8601,
                "current_cycle_end" => current_cycle.ends_at.iso8601
              }
            }
          )
        )

        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:update_subscription_plan).and_return({ success: true })
      end

      after do
        travel_back
      end

      it "creates prorated cycle ending on day 30 of April" do
        result = operation.call(webhook_params)

        expect(result).to be_success

        space_subscription.reload
        prorated_cycle = space_subscription.billing_cycles.find_by("metadata->>'prorated' = 'true'")

        expect(prorated_cycle).to be_present
        expect(prorated_cycle.ends_at.day).to eq(30)
        expect(prorated_cycle.ends_at.month).to eq(4)
        expect(prorated_cycle.ends_at.year).to eq(2025)
      end
    end
  end
end
