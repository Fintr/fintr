# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::SpaceSubscription, type: :model do
  let(:space) { create(:space) }
  let(:subscription_plan) { create(:subscription_plan, token_limit: 100) }
  let(:subscription) do
    create(
      :space_subscription,
      space:,
      subscription_plan:,
      status: "active",
      current_cycle_count: 1
    )
  end

  describe "associations" do
    it { is_expected.to belong_to(:space).class_name("Spaces::Space") }
    it { is_expected.to belong_to(:subscription_plan).class_name("Finance::SubscriptionPlan") }
    it { is_expected.to have_many(:payments).class_name("Finance::Payment").dependent(:destroy) }
    it { is_expected.to have_many(:billing_cycles).class_name("Finance::BillingCycle").dependent(:destroy) }
  end

  describe "validations" do
    subject { build(:space_subscription) }

    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_presence_of(:subscription_type) }
    it { is_expected.to validate_presence_of(:current_cycle_count) }
    it { is_expected.to validate_numericality_of(:current_cycle_count).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:total_cycles).is_greater_than(0).allow_nil }
  end

  describe "enums" do
    describe "subscription_type" do
      it "defines the correct subscription types" do
        expect(described_class.subscription_types).to include(
          "paid" => "paid",
          "sponsor" => "sponsor",
          "free" => "free"
        )
      end

      it "defaults to paid" do
        subscription = build(:space_subscription)
        expect(subscription.subscription_type).to eq("paid")
      end
    end
  end

  describe "scopes" do
    let(:paid_plan) { create(:subscription_plan, slug: "paid-plan-#{SecureRandom.hex(4)}") }
    let(:sponsor_plan) { create(:subscription_plan, slug: "sponsor-plan-#{SecureRandom.hex(4)}") }
    let(:free_plan) { create(:subscription_plan, slug: "free-plan-#{SecureRandom.hex(4)}") }
    let!(:paid_subscription) { create(:space_subscription, subscription_plan: paid_plan, subscription_type: "paid", status: "active") }
    let!(:sponsor_subscription) { create(:space_subscription, subscription_plan: sponsor_plan, subscription_type: "sponsor", status: "active") }
    let!(:free_subscription) { create(:space_subscription, subscription_plan: free_plan, subscription_type: "free", status: "active") }

    describe ".sponsor" do
      it "returns only sponsor subscriptions" do
        expect(described_class.sponsor).to include(sponsor_subscription)
        expect(described_class.sponsor).not_to include(paid_subscription, free_subscription)
      end
    end

    describe ".free" do
      it "returns only free subscriptions" do
        expect(described_class.free).to include(free_subscription)
        expect(described_class.free).not_to include(paid_subscription, sponsor_subscription)
      end
    end

    describe ".paid" do
      it "returns only paid subscriptions" do
        expect(described_class.paid).to include(paid_subscription)
        expect(described_class.paid).not_to include(sponsor_subscription, free_subscription)
      end
    end
  end

  describe "#sponsor_subscription?" do
    context "when subscription type is sponsor" do
      let(:sponsor_subscription) { build(:space_subscription, subscription_type: "sponsor") }

      it "returns true" do
        expect(sponsor_subscription.sponsor_subscription?).to be(true)
      end
    end

    context "when subscription type is not sponsor" do
      let(:paid_subscription) { build(:space_subscription, subscription_type: "paid") }

      it "returns false" do
        expect(paid_subscription.sponsor_subscription?).to be(false)
      end
    end
  end

  describe "#free_subscription?" do
    context "when subscription type is free" do
      let(:free_subscription) { build(:space_subscription, subscription_type: "free") }

      it "returns true" do
        expect(free_subscription.free_subscription?).to be(true)
      end
    end

    context "when subscription type is not free" do
      let(:paid_subscription) { build(:space_subscription, subscription_type: "paid") }

      it "returns false" do
        expect(paid_subscription.free_subscription?).to be(false)
      end
    end
  end

  describe "#paid_subscription?" do
    context "when subscription type is paid" do
      let(:paid_subscription) { build(:space_subscription, subscription_type: "paid") }

      it "returns true" do
        expect(paid_subscription.paid_subscription?).to be(true)
      end
    end

    context "when subscription type is not paid" do
      let(:sponsor_subscription) { build(:space_subscription, subscription_type: "sponsor") }

      it "returns false" do
        expect(sponsor_subscription.paid_subscription?).to be(false)
      end
    end
  end

  describe "#effective_token_limit" do
    context "when subscription is active" do
      it "returns FREE_TOKENS + subscription plan token limit" do
        expect(subscription.effective_token_limit).to eq(
          Spaces::Space::FREE_TOKENS + subscription_plan.token_limit
        )
      end

      it "returns correct tokens for different plan limits" do
        premium_plan = create(:subscription_plan, :premium, token_limit: 250)
        premium_subscription = create(
          :space_subscription,
          space:,
          subscription_plan: premium_plan,
          status: "active"
        )

        expect(premium_subscription.effective_token_limit).to eq(
          Spaces::Space::FREE_TOKENS + 250
        )
      end
    end

    context "when subscription is inactive but in grace period" do
      let(:now) { Time.zone.parse("2025-01-15 12:00:00") }
      let(:cycle_start) { Time.zone.parse("2025-01-01 00:00:00") }
      let(:cycle_end) { Time.zone.parse("2025-01-31 23:59:59") }

      before do
        Timecop.freeze(now)
        subscription.update!(status: "inactive", cancelled_at: now)
      end

      after do
        Timecop.return
      end

      context "with a single paid and active billing cycle" do
        before do
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (cycle_start..cycle_end),
            status: "paid",
            tokens_allocated: 100,
            paid_at: cycle_start,
            xendit_cycle_id: "cycle-1"
          )
        end

        it "returns FREE_TOKENS + tokens from paid active cycles" do
          expect(subscription.effective_token_limit).to eq(
            Spaces::Space::FREE_TOKENS + 100
          )
        end

        it "returns correct tokens when cycle has different token allocation" do
          subscription.billing_cycles.first.update!(tokens_allocated: 150)
          expect(subscription.effective_token_limit).to eq(
            Spaces::Space::FREE_TOKENS + 150
          )
        end
      end

      context "with multiple paid billing cycles" do
        let(:cycle2_start) { Time.zone.parse("2025-02-01 00:00:00") }
        let(:cycle2_end) { Time.zone.parse("2025-02-28 23:59:59") }

        before do
          # First cycle: Jan 1-31 (active, current)
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (cycle_start..cycle_end),
            status: "paid",
            tokens_allocated: 100,
            paid_at: cycle_start,
            xendit_cycle_id: "cycle-1"
          )

          # Second cycle: Feb 1-28 (future, not active yet)
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 2,
            span: (cycle2_start..cycle2_end),
            status: "paid",
            tokens_allocated: 130,
            paid_at: cycle2_start,
            xendit_cycle_id: "cycle-2"
          )
        end

        it "returns tokens only from the current paid and active cycle" do
          # Should only count cycle 1 (current), not cycle 2 (future)
          expect(subscription.effective_token_limit).to eq(
            Spaces::Space::FREE_TOKENS + 100
          )
        end
      end

      context "when billing cycle has expired" do
        let(:expired_cycle_start) { Time.zone.parse("2024-12-01 00:00:00") }
        let(:expired_cycle_end) { Time.zone.parse("2024-12-31 23:59:59") }

        before do
          # Create an expired paid cycle
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (expired_cycle_start..expired_cycle_end),
            status: "paid",
            tokens_allocated: 100,
            paid_at: expired_cycle_start,
            xendit_cycle_id: "cycle-1"
          )
        end

        it "does not include expired cycles in token calculation" do
          expect(subscription.effective_token_limit).to be_nil
        end
      end

      context "when billing cycle is not paid" do
        before do
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (cycle_start..cycle_end),
            status: "pending",
            tokens_allocated: 100,
            xendit_cycle_id: "cycle-1"
          )
        end

        it "does not include unpaid cycles in token calculation" do
          expect(subscription.effective_token_limit).to be_nil
        end
      end

      context "when no paid active cycles exist" do
        it "returns nil" do
          expect(subscription.effective_token_limit).to be_nil
        end
      end
    end

    context "when subscription is inactive and not in grace period" do
      before do
        subscription.update!(status: "inactive", cancelled_at: 1.month.ago)
      end

      it "returns nil" do
        expect(subscription.effective_token_limit).to be_nil
      end
    end
  end

  describe "#in_grace_period?" do
    let(:now) { Time.zone.parse("2025-01-15 12:00:00") }
    let(:cycle_start) { Time.zone.parse("2025-01-01 00:00:00") }
    let(:cycle_end) { Time.zone.parse("2025-01-31 23:59:59") }

    before do
      Timecop.freeze(now)
    end

    after do
      Timecop.return
    end

    context "when subscription is active" do
      it "returns false" do
        expect(subscription.in_grace_period?).to be false
      end
    end

    context "when subscription is inactive" do
      before do
        subscription.update!(status: "inactive", cancelled_at: now)
      end

      context "with paid and active billing cycles" do
        before do
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (cycle_start..cycle_end),
            status: "paid",
            tokens_allocated: 100,
            paid_at: cycle_start,
            xendit_cycle_id: "cycle-1"
          )
        end

        it "returns true" do
          expect(subscription.in_grace_period?).to be true
        end
      end

      context "with expired paid cycles" do
        let(:expired_cycle_start) { Time.zone.parse("2024-12-01 00:00:00") }
        let(:expired_cycle_end) { Time.zone.parse("2024-12-31 23:59:59") }

        before do
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (expired_cycle_start..expired_cycle_end),
            status: "paid",
            tokens_allocated: 100,
            paid_at: expired_cycle_start,
            xendit_cycle_id: "cycle-1"
          )
        end

        it "returns false" do
          expect(subscription.in_grace_period?).to be false
        end
      end

      context "with unpaid cycles" do
        before do
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (cycle_start..cycle_end),
            status: "pending",
            tokens_allocated: 100,
            xendit_cycle_id: "cycle-1"
          )
        end

        it "returns false" do
          expect(subscription.in_grace_period?).to be false
        end
      end

      context "with no billing cycles" do
        it "returns false" do
          expect(subscription.in_grace_period?).to be false
        end
      end
    end
  end

  describe "#grace_period_ends_at" do
    let(:now) { Time.zone.parse("2025-01-15 12:00:00") }
    let(:cycle_start) { Time.zone.parse("2025-01-01 00:00:00") }
    let(:cycle_end) { Time.zone.parse("2025-01-31 23:59:59") }

    before do
      Timecop.freeze(now)
    end

    after do
      Timecop.return
    end

    context "when subscription is active" do
      it "returns nil" do
        expect(subscription.grace_period_ends_at).to be_nil
      end
    end

    context "when subscription is inactive and in grace period" do
      before do
        subscription.update!(status: "inactive", cancelled_at: now)
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle_start..cycle_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: cycle_start,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "returns the end date of the current paid cycle" do
        expect(subscription.grace_period_ends_at).to be_within(1.second).of(cycle_end)
      end

      context "with multiple paid cycles" do
        # Create overlapping cycles that are both active at the current time
        let(:cycle2_start) { Time.zone.parse("2025-01-10 00:00:00") }
        let(:cycle2_end) { Time.zone.parse("2025-01-20 23:59:59") }

        before do
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 2,
            span: (cycle2_start..cycle2_end),
            status: "paid",
            tokens_allocated: 100,
            paid_at: cycle2_start,
            xendit_cycle_id: "cycle-2"
          )
        end

        it "returns the end date of the most recent paid cycle" do
          # current_paid_cycle orders by cycle_number desc, so cycle 2 should be returned
          expect(subscription.grace_period_ends_at).to be_within(1.second).of(cycle2_end)
        end
      end
    end

    context "when subscription is cancelled but not in grace period yet" do
      let(:current_cycle_start) { Time.zone.parse("2025-01-01 00:00:00") }
      let(:current_cycle_end) { Time.zone.parse("2025-01-31 23:59:59") }

      before do
        subscription.update!(status: "inactive", cancelled_at: now)
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (current_cycle_start..current_cycle_end),
          status: "pending",
          tokens_allocated: 100,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "returns the end date of the current active cycle" do
        expect(subscription.grace_period_ends_at).to be_within(1.second).of(current_cycle_end)
      end
    end

    context "when subscription is inactive with no cycles" do
      before do
        subscription.update!(status: "inactive", cancelled_at: now)
      end

      it "returns nil" do
        expect(subscription.grace_period_ends_at).to be_nil
      end
    end
  end

  describe "#paid_and_active_cycles" do
    let(:now) { Time.zone.parse("2025-01-15 12:00:00") }
    let(:cycle1_start) { Time.zone.parse("2024-12-01 00:00:00") }
    let(:cycle1_end) { Time.zone.parse("2024-12-31 23:59:59") }
    let(:cycle2_start) { Time.zone.parse("2025-01-01 00:00:00") }
    let(:cycle2_end) { Time.zone.parse("2025-01-31 23:59:59") }

    before do
      Timecop.freeze(now)
    end

    after do
      Timecop.return
    end

    context "with mixed cycle statuses" do
      before do
        # Expired paid cycle (should not be included)
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle1_start..cycle1_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: cycle1_start,
          xendit_cycle_id: "cycle-1"
        )

        # Active paid cycle (should be included - this is the current one)
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 2,
          span: (cycle2_start..cycle2_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: cycle2_start,
          xendit_cycle_id: "cycle-2"
        )

        # Active pending cycle (should not be included)
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 3,
          span: (cycle2_start..cycle2_end),
          status: "pending",
          tokens_allocated: 100,
          xendit_cycle_id: "cycle-3"
        )
      end

      it "returns only the current paid and active cycle (billing cycles are exclusive)" do
        cycles = subscription.paid_and_active_cycles
        expect(cycles.count).to eq(1)
        expect(cycles.first.cycle_number).to eq(2)
      end
    end

    context "with no paid active cycles" do
      before do
        # Only pending cycle
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle2_start..cycle2_end),
          status: "pending",
          tokens_allocated: 100,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "returns empty relation" do
        cycles = subscription.paid_and_active_cycles
        expect(cycles.count).to eq(0)
      end
    end
  end

  describe "time-based scenarios with timecop" do
    let(:base_time) { Time.zone.parse("2025-01-15 12:00:00") }
    let(:cycle_start) { Time.zone.parse("2025-01-01 00:00:00") }
    let(:cycle_end) { Time.zone.parse("2025-01-31 23:59:59") }

    before do
      Timecop.freeze(base_time)
    end

    after do
      Timecop.return
    end

    context "when moving through billing cycle timeline" do
      before do
        subscription.update!(status: "inactive", cancelled_at: base_time)
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle_start..cycle_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: cycle_start,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "maintains grace period during the cycle" do
        # Move to middle of cycle
        Timecop.freeze(Time.zone.parse("2025-01-15 12:00:00"))
        expect(subscription.in_grace_period?).to be true
        expect(subscription.effective_token_limit).to eq(
          Spaces::Space::FREE_TOKENS + 100
        )

        # Move to end of cycle
        Timecop.freeze(Time.zone.parse("2025-01-31 23:59:59"))
        expect(subscription.in_grace_period?).to be true
        expect(subscription.effective_token_limit).to eq(
          Spaces::Space::FREE_TOKENS + 100
        )
      end

      it "ends grace period after cycle expires" do
        # Move past cycle end
        Timecop.freeze(Time.zone.parse("2025-02-01 00:00:01"))
        expect(subscription.in_grace_period?).to be false
        expect(subscription.effective_token_limit).to be_nil
      end
    end

    context "when subscription transitions from active to cancelled" do
      it "maintains tokens during grace period" do
        # Start with active subscription
        expect(subscription.active?).to be true
        expect(subscription.effective_token_limit).to eq(
          Spaces::Space::FREE_TOKENS + 100
        )

        # Create a paid cycle
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle_start..cycle_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: cycle_start,
          xendit_cycle_id: "cycle-1"
        )

        # Cancel subscription
        subscription.update!(status: "inactive", cancelled_at: base_time)

        # Should still have tokens during grace period
        expect(subscription.in_grace_period?).to be true
        expect(subscription.effective_token_limit).to eq(
          Spaces::Space::FREE_TOKENS + 100
        )
      end
    end
  end

  describe "#active?" do
    it "returns true when status is active" do
      subscription.update!(status: "active")
      expect(subscription.active?).to be(true)
    end

    it "returns false when status is not active" do
      subscription.update!(status: "inactive")
      expect(subscription.active?).to be(false)
    end
  end

  describe "#token_limit" do
    it "returns subscription plan token limit" do
      expect(subscription.token_limit).to eq(subscription_plan.token_limit)
    end
  end

  describe "#expired?" do
    context "when ended_at is in the past" do
      it "returns true" do
        subscription.update!(ended_at: 1.day.ago)
        expect(subscription.expired?).to be(true)
      end
    end

    context "when ended_at is in the future" do
      it "returns false" do
        subscription.update!(ended_at: 1.day.from_now)
        expect(subscription.expired?).to be(false)
      end
    end

    context "when ended_at is nil" do
      it "returns false" do
        subscription.update!(ended_at: nil)
        expect(subscription.expired?).to be(false)
      end
    end
  end

  describe "#completed?" do
    context "when total_cycles is nil" do
      it "returns false" do
        subscription.update!(total_cycles: nil)
        expect(subscription.completed?).to be(false)
      end
    end

    context "when current_cycle_count is less than total_cycles" do
      it "returns false" do
        subscription.update!(total_cycles: 10, current_cycle_count: 5)
        expect(subscription.completed?).to be(false)
      end
    end

    context "when current_cycle_count equals total_cycles" do
      it "returns true" do
        subscription.update!(total_cycles: 10, current_cycle_count: 10)
        expect(subscription.completed?).to be(true)
      end
    end

    context "when current_cycle_count exceeds total_cycles" do
      it "returns true" do
        subscription.update!(total_cycles: 10, current_cycle_count: 11)
        expect(subscription.completed?).to be(true)
      end
    end
  end

  describe "#current_paid_cycle" do
    let(:now) { Time.zone.parse("2025-01-15 12:00:00") }
    let(:cycle1_start) { Time.zone.parse("2024-12-01 00:00:00") }
    let(:cycle1_end) { Time.zone.parse("2024-12-31 23:59:59") }
    let(:cycle2_start) { Time.zone.parse("2025-01-01 00:00:00") }
    let(:cycle2_end) { Time.zone.parse("2025-01-31 23:59:59") }

    before do
      Timecop.freeze(now)
    end

    after do
      Timecop.return
    end

    context "when there are multiple paid cycles" do
      before do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle1_start..cycle1_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: cycle1_start,
          xendit_cycle_id: "cycle-1"
        )
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 2,
          span: (cycle2_start..cycle2_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: cycle2_start,
          xendit_cycle_id: "cycle-2"
        )
      end

      it "returns the most recent paid and active cycle" do
        current_cycle = subscription.current_paid_cycle
        expect(current_cycle).to be_present
        expect(current_cycle.cycle_number).to eq(2)
      end
    end

    context "when there are no paid cycles" do
      it "returns nil" do
        expect(subscription.current_paid_cycle).to be_nil
      end
    end

    context "when there are paid cycles but none are active" do
      let(:expired_cycle_start) { Time.zone.parse("2024-12-01 00:00:00") }
      let(:expired_cycle_end) { Time.zone.parse("2024-12-31 23:59:59") }

      before do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (expired_cycle_start..expired_cycle_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: expired_cycle_start,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "returns nil" do
        expect(subscription.current_paid_cycle).to be_nil
      end
    end

    context "when there are pending cycles but no paid cycles" do
      before do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle2_start..cycle2_end),
          status: "pending",
          tokens_allocated: 100,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "returns nil" do
        expect(subscription.current_paid_cycle).to be_nil
      end
    end
  end

  describe "#current_failed_cycle" do
    let(:now) { Time.zone.parse("2025-01-15 12:00:00") }
    let(:cycle1_start) { Time.zone.parse("2025-01-01 00:00:00") }
    let(:cycle1_end) { Time.zone.parse("2025-01-31 23:59:59") }
    let(:cycle2_start) { Time.zone.parse("2025-02-01 00:00:00") }
    let(:cycle2_end) { Time.zone.parse("2025-02-28 23:59:59") }

    before do
      Timecop.freeze(now)
    end

    after do
      Timecop.return
    end

    context "when there are multiple failed cycles with action_url" do
      before do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle1_start..cycle1_end),
          status: "failed",
          action_url: "https://example.com/retry-1",
          xendit_cycle_id: "cycle-1"
        )
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 2,
          span: (cycle2_start..cycle2_end),
          status: "failed",
          action_url: "https://example.com/retry-2",
          xendit_cycle_id: "cycle-2"
        )
      end

      it "returns the most recent failed cycle with action_url" do
        failed_cycle = subscription.current_failed_cycle
        expect(failed_cycle).to be_present
        expect(failed_cycle.cycle_number).to eq(2)
        expect(failed_cycle.action_url).to eq("https://example.com/retry-2")
      end
    end

    context "when there are failed cycles without action_url" do
      before do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle1_start..cycle1_end),
          status: "failed",
          action_url: nil,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "returns nil" do
        expect(subscription.current_failed_cycle).to be_nil
      end
    end

    context "when there are no failed cycles" do
      it "returns nil" do
        expect(subscription.current_failed_cycle).to be_nil
      end
    end

    context "when there are failed cycles with action_url and without action_url" do
      before do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (cycle1_start..cycle1_end),
          status: "failed",
          action_url: nil,
          xendit_cycle_id: "cycle-1"
        )
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 2,
          span: (cycle2_start..cycle2_end),
          status: "failed",
          action_url: "https://example.com/retry-2",
          xendit_cycle_id: "cycle-2"
        )
      end

      it "returns only the failed cycle with action_url" do
        failed_cycle = subscription.current_failed_cycle
        expect(failed_cycle).to be_present
        expect(failed_cycle.cycle_number).to eq(2)
        expect(failed_cycle.action_url).to be_present
      end
    end
  end

  describe "#can_change_plan?" do
    let(:now) { Time.zone.parse("2025-01-15 12:00:00") }
    let(:cycle_start) { Time.zone.parse("2025-01-01 00:00:00") }
    let(:cycle_end) { Time.zone.parse("2025-01-31 23:59:59") }

    before do
      Timecop.freeze(now)
    end

    after do
      Timecop.return
    end

    context "when subscription is active" do
      before do
        subscription.update!(status: "active")
      end

      it "returns true when there are no failed cycles" do
        expect(subscription.can_change_plan?).to be(true)
      end

      context "when there are failed billing cycles" do
        before do
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            status: "failed"
          )
        end

        it "returns false" do
          expect(subscription.can_change_plan?).to be(false)
        end
      end

      context "when plan change already occurred in current cycle" do
        before do
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (cycle_start..cycle_end),
            status: "paid",
            tokens_allocated: 100,
            paid_at: cycle_start,
            xendit_cycle_id: "cycle-1"
          )
          subscription.update!(
            metadata: {
              "plan_change" => {
                "changed_at" => Time.zone.parse("2025-01-10 12:00:00").iso8601
              }
            }
          )
        end

        it "returns false" do
          expect(subscription.can_change_plan?).to be(false)
        end
      end

      context "when prorated cycle exists for current cycle" do
        before do
          current_cycle = create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            span: (cycle_start..cycle_end),
            status: "paid",
            tokens_allocated: 100,
            paid_at: cycle_start,
            xendit_cycle_id: "cycle-1"
          )
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1.1,
            metadata: { "prorated" => "true" },
            xendit_cycle_id: "cycle-1-1"
          )
        end

        it "returns false" do
          expect(subscription.can_change_plan?).to be(false)
        end
      end

      context "when no current cycle but prorated cycles exist" do
        before do
          subscription.update!(
            metadata: {
              "plan_change" => {
                "changed_at" => Time.zone.parse("2025-01-10 12:00:00").iso8601
              }
            }
          )
          create(
            :finance_billing_cycle,
            space_subscription: subscription,
            cycle_number: 1,
            metadata: { "prorated" => "true" },
            xendit_cycle_id: "cycle-1"
          )
        end

        it "returns false" do
          expect(subscription.can_change_plan?).to be(false)
        end
      end

      context "when all conditions are met" do
        it "returns true" do
          expect(subscription.can_change_plan?).to be(true)
        end
      end
    end

    context "when subscription is not active" do
      before do
        subscription.update!(status: "inactive")
      end

      it "returns false" do
        expect(subscription.can_change_plan?).to be(false)
      end
    end
  end
end
