# frozen_string_literal: true

require "rails_helper"

module Finance
  RSpec.describe RenewFreeSubscriptionCyclesJob, type: :job do
    describe "#perform" do
      let(:user) { create(:user) }
      let(:admin) { create(:user) }

      let!(:monthly_plan) do
        create(
          :subscription_plan,
          slug: "monthly-#{SecureRandom.hex(4)}",
          interval: "month",
          token_limit: 1000,
          price_cents: 50000
        )
      end

      let!(:yearly_plan) do
        create(
          :subscription_plan,
          slug: "yearly-#{SecureRandom.hex(4)}",
          interval: "year",
          token_limit: 12000,
          price_cents: 500000
        )
      end

      around do |example|
        Time.use_zone("Asia/Manila") do
          example.run
        end
      end

      it "renews free subscriptions with cycles ending within 3 days" do
        # Create a free subscription with a billing cycle ending in 2 days
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now
        )

        expect do
          described_class.perform_now
        end.to change { subscription.billing_cycles.count }.by(1)

        # Verify cycle was created
        cycles = subscription.billing_cycles.order(:cycle_number)
        expect(cycles.count).to eq(2)
        expect(cycles.last.cycle_number).to eq(2.0)
        expect(cycles.last.status).to eq("paid")
        expect(subscription.reload.current_cycle_count).to eq(2)
      end

      it "does not renew subscriptions with cycles ending far in the future" do
        # Create a free subscription with a billing cycle ending in 20 days
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 10.days.ago,
          cycle_end: 20.days.from_now
        )

        described_class.perform_now

        # Should still only have 1 cycle
        expect(subscription.billing_cycles.count).to eq(1)
        expect(subscription.reload.current_cycle_count).to eq(1)
      end

      it "does not renew paid subscriptions" do
        # Create a paid subscription with a billing cycle ending in 2 days
        space = create(:personal_space, owner: user)
        subscription = create_paid_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now
        )

        described_class.perform_now

        # Paid subscription should not get a new cycle
        expect(subscription.billing_cycles.count).to eq(1)
        expect(subscription.reload.current_cycle_count).to eq(1)
      end

      it "sets correct span dates for monthly subscriptions" do
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now
        )

        described_class.perform_now

        previous_cycle = subscription.billing_cycles.order(:cycle_number).first
        new_cycle = subscription.billing_cycles.order(:cycle_number).last

        # New cycle should start when previous ended
        expect(new_cycle.started_at).to be_within(1.second).of(previous_cycle.ends_at)
        # New cycle should end approximately 1 month later
        expect(new_cycle.ends_at).to be_within(1.day).of(previous_cycle.ends_at + 1.month)
      end

      it "sets correct span dates for yearly subscriptions" do
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: yearly_plan,
          cycle_start: 1.year.ago - 28.days,
          cycle_end: 2.days.from_now
        )

        described_class.perform_now

        previous_cycle = subscription.billing_cycles.order(:cycle_number).first
        new_cycle = subscription.billing_cycles.order(:cycle_number).last

        expect(new_cycle.started_at).to be_within(1.second).of(previous_cycle.ends_at)
        expect(new_cycle.ends_at).to be_within(1.day).of(previous_cycle.ends_at + 1.year)
      end

      it "stores metadata with auto_renewed flag" do
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now
        )

        first_cycle = subscription.billing_cycles.order(:cycle_number).first

        described_class.perform_now

        new_cycle = subscription.billing_cycles.order(:cycle_number).last
        expect(new_cycle.metadata["auto_renewed"]).to be(true)
        expect(new_cycle.metadata["free_subscription"]).to be(true)
        expect(new_cycle.metadata["previous_cycle_id"]).to eq(first_cycle.id)
      end

      it "leaves xendit_cycle_id as nil for free subscriptions" do
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now
        )

        described_class.perform_now

        new_cycle = subscription.billing_cycles.order(:cycle_number).last
        expect(new_cycle.xendit_cycle_id).to be_nil
      end

      it "advances to the next cycle when a cycle already exists" do
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now
        )

        # Manually create cycle 2 (simulating a previous renewal)
        previous_cycle = subscription.billing_cycles.order(:cycle_number).first
        Finance::BillingCycle.create!(
          space_subscription: subscription,
          cycle_number: 2.0,
          span: (previous_cycle.ends_at..(previous_cycle.ends_at + 1.month)),
          status: "paid",
          tokens_allocated: monthly_plan.token_limit,
          paid_at: Time.zone.now,
          xendit_cycle_id: nil,
          metadata: { free_subscription: true, auto_renewed: true }
        )
        subscription.increment!(:current_cycle_count)

        # The job finds the subscription (cycle 1 ends within 3 days)
        # Then gets cycle 2 as current, and creates cycle 3
        expect do
          described_class.perform_now
        end.to change { subscription.billing_cycles.count }.by(1)

        # Should now have 3 cycles
        expect(subscription.billing_cycles.count).to eq(3)
        expect(subscription.billing_cycles.order(:cycle_number).last.cycle_number).to eq(3.0)
      end

      it "handles different timezones correctly" do
        Time.use_zone("UTC") do
          space = create(:personal_space, owner: user)
          subscription = create_free_subscription_with_cycle(
            space: space,
            plan: monthly_plan,
            cycle_start: 28.days.ago,
            cycle_end: 2.days.from_now
          )

          expect do
            described_class.perform_now
          end.to change { subscription.billing_cycles.count }.by(1)
        end
      end

      it "handles subscription with no billing cycles gracefully" do
        space = create(:personal_space, owner: user)
        subscription = Finance::SpaceSubscription.create!(
          space: space,
          subscription_plan: monthly_plan,
          subscription_type: "free",
          status: "active",
          started_at: Time.zone.now,
          current_cycle_count: 0,
          metadata: { is_free_subscription: true }
        )

        expect do
          described_class.perform_now
        end.not_to(change(Finance::BillingCycle, :count))

        expect(subscription.billing_cycles.count).to eq(0)
      end

      it "handles inactive subscriptions gracefully" do
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now,
          status: "inactive"
        )

        described_class.perform_now

        expect(subscription.billing_cycles.count).to eq(1)
        expect(subscription.reload.current_cycle_count).to eq(1)
      end

      it "handles cycle ending exactly 3 days from now" do
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 27.days.ago,
          cycle_end: 3.days.from_now
        )

        expect do
          described_class.perform_now
        end.to change { subscription.billing_cycles.count }.by(1)
      end

      it "does not renew cycle ending just after 3 days" do
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 27.days.ago,
          cycle_end: 3.days.from_now + 1.minute
        )

        expect do
          described_class.perform_now
        end.not_to(change { subscription.billing_cycles.count })
      end

      it "logs successful renewal" do
        allow(Rails.logger).to receive(:info)

        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now
        )

        described_class.perform_now

        expect(Rails.logger).to have_received(:info).with(
          /Renewed free subscription #{subscription.id}/
        )
      end

      it "logs errors when creation fails" do
        # Create subscription first (before stubbing)
        space = create(:personal_space, owner: user)
        subscription = create_free_subscription_with_cycle(
          space: space,
          plan: monthly_plan,
          cycle_start: 28.days.ago,
          cycle_end: 2.days.from_now
        )

        # Now stub create! to fail for the renewal attempt
        call_count = 0
        allow(Finance::BillingCycle).to receive(:create!) do |*args|
          call_count += 1
          # Fail on the second call (the renewal attempt)
          if call_count > 1
            raise StandardError, "Database error"
          else
            # Call original for first call (already happened in helper)
            raise StandardError, "Unexpected call"
          end
        end
        allow(Rails.logger).to receive(:error)

        described_class.perform_now

        expect(Rails.logger).to have_received(:error).with(
          /Failed to renew free subscription #{subscription.id}/
        )
      end

      # Helper methods
      def create_free_subscription_with_cycle(space:, plan:, cycle_start:, cycle_end:, status: "active")
        subscription = Finance::SpaceSubscription.create!(
          space: space,
          subscription_plan: plan,
          subscription_type: "free",
          status: status,
          started_at: cycle_start,
          current_cycle_count: 1,
          metadata: {
            granted_by: admin.id.to_s,
            granted_at: cycle_start.iso8601,
            is_free_subscription: true
          }
        )

        Finance::BillingCycle.create!(
          space_subscription: subscription,
          cycle_number: 1.0,
          span: (cycle_start..cycle_end),
          status: "paid",
          tokens_allocated: plan.token_limit,
          paid_at: cycle_start,
          xendit_cycle_id: nil,
          metadata: { free_subscription: true }
        )

        subscription
      end

      def create_paid_subscription_with_cycle(space:, plan:, cycle_start:, cycle_end:)
        subscription = Finance::SpaceSubscription.create!(
          space: space,
          subscription_plan: plan,
          subscription_type: "paid",
          status: "active",
          started_at: cycle_start,
          current_cycle_count: 1,
          xendit_plan_id: "plan_123",
          xendit_reference_id: "ref_123",
          metadata: {}
        )

        Finance::BillingCycle.create!(
          space_subscription: subscription,
          cycle_number: 1.0,
          span: (cycle_start..cycle_end),
          status: "paid",
          tokens_allocated: plan.token_limit,
          paid_at: cycle_start,
          xendit_cycle_id: "cycle_123",
          metadata: {}
        )

        subscription
      end
    end
  end
end
