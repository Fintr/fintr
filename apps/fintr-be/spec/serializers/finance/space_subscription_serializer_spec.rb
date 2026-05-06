# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::SpaceSubscriptionSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(space_subscription) }

  let(:space) { create(:space) }
  let(:subscription_plan) { create(:subscription_plan, slug: "basic", token_limit: 50, price_cents: 14_900) }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: subscription_plan,
      status: "active",
      started_at: Time.zone.parse("2025-01-01 10:00:00"),
      current_cycle_count: 2,
      total_cycles: 12,
      metadata: {}
    )
  end

  describe "basic fields" do
    it "includes the id" do
      expect(serialized_hash[:id]).to eq(space_subscription.id)
    end

    it "includes the status" do
      expect(serialized_hash[:status]).to eq("active")
    end

    it "includes startedAt" do
      expect(serialized_hash[:startedAt]).to eq(space_subscription.started_at)
    end

    it "includes endedAt" do
      expect(serialized_hash[:endedAt]).to eq(space_subscription.ended_at)
    end

    it "includes currentCycleCount" do
      expect(serialized_hash[:currentCycleCount]).to eq(2)
    end

    it "includes totalCycles" do
      expect(serialized_hash[:totalCycles]).to eq(12)
    end

    it "includes createdAt" do
      expect(serialized_hash[:createdAt]).to eq(space_subscription.created_at)
    end

    it "includes updatedAt" do
      expect(serialized_hash[:updatedAt]).to eq(space_subscription.updated_at)
    end
  end

  describe "subscriptionPlan association" do
    it "includes subscriptionPlan" do
      expect(serialized_hash[:subscriptionPlan]).to be_present
    end

    it "serializes subscriptionPlan using SubscriptionPlanSerializer" do
      plan_hash = serialized_hash[:subscriptionPlan]
      expect(plan_hash).to be_a(Hash)
      expect(plan_hash[:id]).to eq(subscription_plan.id)
    end
  end

  describe "gracePeriodEndsAt field" do
    context "when subscription is active" do
      it "returns nil" do
        expect(serialized_hash[:gracePeriodEndsAt]).to be_nil
      end
    end

    context "when subscription is inactive and in grace period" do
      let(:now) { Time.zone.parse("2025-01-15 12:00:00") }
      let(:cycle_start) { Time.zone.parse("2025-01-01 00:00:00") }
      let(:cycle_end) { Time.zone.parse("2025-01-31 23:59:59") }
      let(:space_subscription) do
        create(
          :space_subscription,
          :inactive,
          space: space,
          subscription_plan: subscription_plan,
          cancelled_at: now,
          metadata: {}
        )
      end

      before do
        Timecop.freeze(now)
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1,
          span: (cycle_start..cycle_end),
          status: "paid",
          tokens_allocated: 100,
          paid_at: cycle_start,
          xendit_cycle_id: "cycle-1"
        )
      end

      after do
        Timecop.return
      end

      it "returns ISO8601 formatted grace period end date" do
        expect(serialized_hash[:gracePeriodEndsAt]).to eq(cycle_end.iso8601)
      end
    end

    context "when subscription is cancelled but not in grace period" do
      let(:space_subscription) do
        create(
          :space_subscription,
          :inactive,
          space: space,
          subscription_plan: subscription_plan,
          cancelled_at: Time.zone.now,
          metadata: {}
        )
      end

      it "returns nil" do
        expect(serialized_hash[:gracePeriodEndsAt]).to be_nil
      end
    end
  end

  describe "currentFailedCycle association" do
    context "when subscription has no failed cycle" do
      it "does not include currentFailedCycle" do
        expect(serialized_hash).not_to have_key(:currentFailedCycle)
      end
    end

    context "when subscription has a failed cycle without action_url" do
      before do
        create(
          :finance_billing_cycle,
          :failed,
          space_subscription: space_subscription,
          cycle_number: 1,
          action_url: nil
        )
      end

      it "does not include currentFailedCycle" do
        expect(serialized_hash).not_to have_key(:currentFailedCycle)
      end
    end

    context "when subscription has a failed cycle with action_url" do
      let(:failed_cycle) do
        create(
          :finance_billing_cycle,
          :failed,
          space_subscription: space_subscription,
          cycle_number: 1,
          action_url: "https://example.com/retry"
        )
      end

      before do
        failed_cycle
      end

      it "includes currentFailedCycle" do
        expect(serialized_hash[:currentFailedCycle]).to be_present
      end

      it "serializes currentFailedCycle using BillingCycleSerializer" do
        cycle_hash = serialized_hash[:currentFailedCycle]
        expect(cycle_hash).to be_a(Hash)
        expect(cycle_hash[:id]).to eq(failed_cycle.id)
      end
    end

    context "when subscription has multiple failed cycles" do
      let(:older_failed_cycle) do
        create(
          :finance_billing_cycle,
          :failed,
          space_subscription: space_subscription,
          cycle_number: 1,
          action_url: "https://example.com/retry-old"
        )
      end
      let(:newer_failed_cycle) do
        create(
          :finance_billing_cycle,
          :failed,
          space_subscription: space_subscription,
          cycle_number: 2,
          action_url: "https://example.com/retry-new"
        )
      end

      before do
        older_failed_cycle
        newer_failed_cycle
      end

      it "includes the most recent failed cycle" do
        expect(serialized_hash[:currentFailedCycle][:id]).to eq(newer_failed_cycle.id)
      end
    end
  end

  describe "actionUrl field" do
    context "when metadata has action_url" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          metadata: {
            "action_url" => "https://example.com/action"
          }
        )
      end

      it "extracts action_url from metadata" do
        expect(serialized_hash[:actionUrl]).to eq("https://example.com/action")
      end
    end

    context "when metadata has actions array with url" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          metadata: {
            "actions" => [
              {
                "url" => "https://example.com/action-from-array"
              }
            ]
          }
        )
      end

      it "extracts action_url from actions array" do
        expect(serialized_hash[:actionUrl]).to eq("https://example.com/action-from-array")
      end
    end

    context "when metadata has actions array with redirect_url" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          metadata: {
            "actions" => [
              {
                "redirect_url" => "https://example.com/redirect"
              }
            ]
          }
        )
      end

      it "extracts redirect_url from actions array" do
        expect(serialized_hash[:actionUrl]).to eq("https://example.com/redirect")
      end
    end

    context "when metadata has no action_url" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          metadata: {}
        )
      end

      it "returns nil" do
        expect(serialized_hash[:actionUrl]).to be_nil
      end
    end
  end

  describe "billingCycles association" do
    context "when subscription has no billing cycles" do
      it "includes empty billingCycles array" do
        expect(serialized_hash[:billingCycles]).to eq([])
      end
    end

    context "when subscription has billing cycles" do
      let(:cycle1) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1,
          status: "paid"
        )
      end
      let(:cycle2) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 2,
          status: "pending"
        )
      end
      let(:cycle3) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 3,
          status: "failed"
        )
      end

      before do
        cycle1
        cycle2
        cycle3
      end

      it "includes all billing cycles" do
        expect(serialized_hash[:billingCycles].length).to eq(3)
      end

      it "orders billing cycles by cycle_number descending" do
        cycle_numbers = serialized_hash[:billingCycles].map { |c| c[:cycleNumber] }
        expect(cycle_numbers).to eq([3, 2, 1])
      end

      it "serializes billing cycles using BillingCycleSerializer" do
        first_cycle = serialized_hash[:billingCycles].first
        expect(first_cycle).to be_a(Hash)
        expect(first_cycle[:id]).to eq(cycle3.id)
      end
    end
  end

  describe "canChangePlan field" do
    context "when subscription is active and can change plan" do
      let(:space_subscription) do
        create(
          :space_subscription,
          :active,
          space: space,
          subscription_plan: subscription_plan,
          metadata: {}
        )
      end

      it "returns true" do
        expect(serialized_hash[:canChangePlan]).to be true
      end
    end

    context "when subscription is inactive" do
      let(:space_subscription) do
        create(
          :space_subscription,
          :inactive,
          space: space,
          subscription_plan: subscription_plan,
          metadata: {}
        )
      end

      it "returns false" do
        expect(serialized_hash[:canChangePlan]).to be false
      end
    end

    context "when subscription has failed billing cycles" do
      let(:space_subscription) do
        create(
          :space_subscription,
          :active,
          space: space,
          subscription_plan: subscription_plan,
          metadata: {}
        )
      end

      before do
        create(
          :finance_billing_cycle,
          :failed,
          space_subscription: space_subscription,
          cycle_number: 1
        )
      end

      it "returns false" do
        expect(serialized_hash[:canChangePlan]).to be false
      end
    end

    context "when subscription has plan change in current cycle" do
      let(:current_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1,
          status: "paid",
          span: (1.month.ago.beginning_of_month..Time.zone.now.end_of_month)
        )
      end
      let(:space_subscription) do
        create(
          :space_subscription,
          :active,
          space: space,
          subscription_plan: subscription_plan,
          started_at: 1.month.ago,
          metadata: {
            "plan_change" => {
              "changed_at" => Time.zone.now.iso8601
            }
          }
        )
      end

      before do
        current_cycle
      end

      it "returns false" do
        expect(serialized_hash[:canChangePlan]).to be false
      end
    end
  end

  describe "field name transformations" do
    it "uses camelCase for all field names" do
      expect(serialized_hash.keys).to include(
        :subscriptionPlan,
        :startedAt,
        :endedAt,
        :currentCycleCount,
        :totalCycles,
        :createdAt,
        :updatedAt,
        :gracePeriodEndsAt,
        :actionUrl,
        :billingCycles,
        :canChangePlan,
        :subscriptionType,
        :isSponsorSubscription
      )
    end

    it "does not include snake_case field names" do
      expect(serialized_hash.keys).not_to include(
        :subscription_plan,
        :started_at,
        :ended_at,
        :current_cycle_count,
        :total_cycles,
        :created_at,
        :updated_at,
        :grace_period_ends_at,
        :current_failed_cycle,
        :action_url,
        :billing_cycles,
        :can_change_plan,
        :subscription_type,
        :is_sponsor_subscription,
        :sponsor_metadata
      )
    end

    context "when currentFailedCycle is present" do
      before do
        create(
          :finance_billing_cycle,
          :failed,
          space_subscription: space_subscription,
          cycle_number: 1,
          action_url: "https://example.com/retry"
        )
      end

      it "includes currentFailedCycle in camelCase" do
        expect(serialized_hash.keys).to include(:currentFailedCycle)
        expect(serialized_hash.keys).not_to include(:current_failed_cycle)
      end
    end
  end

  describe "serialization structure" do
    it "serializes all expected top-level fields" do
      expected_keys = [
        :id,
        :subscriptionPlan,
        :status,
        :subscriptionType,
        :isSponsorSubscription,
        :startedAt,
        :endedAt,
        :currentCycleCount,
        :totalCycles,
        :createdAt,
        :updatedAt,
        :gracePeriodEndsAt,
        :actionUrl,
        :billingCycles,
        :canChangePlan
      ]
      expect(serialized_hash.keys).to include(*expected_keys)
    end

    it "returns a hash with symbol keys" do
      expect(serialized_hash).to be_a(Hash)
      expect(serialized_hash.keys).to all(be_a(Symbol))
    end
  end

  context "with different subscription statuses" do
    context "when subscription is pending" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          status: "pending"
        )
      end

      it "includes pending status" do
        expect(serialized_hash[:status]).to eq("pending")
      end
    end

    context "when subscription is requires_action" do
      let(:space_subscription) do
        create(
          :space_subscription,
          :requires_action,
          space: space,
          subscription_plan: subscription_plan
        )
      end

      it "includes requires_action status" do
        expect(serialized_hash[:status]).to eq("requires_action")
      end
    end

    context "when subscription is inactive" do
      let(:space_subscription) do
        create(
          :space_subscription,
          :inactive,
          space: space,
          subscription_plan: subscription_plan
        )
      end

      it "includes inactive status" do
        expect(serialized_hash[:status]).to eq("inactive")
      end
    end
  end

  context "with nil values" do
    let(:space_subscription) do
      create(
        :space_subscription,
        space: space,
        subscription_plan: subscription_plan,
        ended_at: nil,
        total_cycles: nil
      )
    end

    it "includes nil fields" do
      expect(serialized_hash[:endedAt]).to be_nil
      expect(serialized_hash[:totalCycles]).to be_nil
    end
  end

  describe "subscriptionType field" do
    context "when subscription is paid" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "paid"
        )
      end

      it "returns 'paid'" do
        expect(serialized_hash[:subscriptionType]).to eq("paid")
      end
    end

    context "when subscription is sponsor" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "sponsor"
        )
      end

      it "returns 'sponsor'" do
        expect(serialized_hash[:subscriptionType]).to eq("sponsor")
      end
    end

    context "when subscription is free" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "free"
        )
      end

      it "returns 'free'" do
        expect(serialized_hash[:subscriptionType]).to eq("free")
      end
    end
  end

  describe "isSponsorSubscription field" do
    context "when subscription type is sponsor" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "sponsor"
        )
      end

      it "returns true" do
        expect(serialized_hash[:isSponsorSubscription]).to be(true)
      end
    end

    context "when subscription type is paid" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "paid"
        )
      end

      it "returns false" do
        expect(serialized_hash[:isSponsorSubscription]).to be(false)
      end
    end

    context "when subscription type is free" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "free"
        )
      end

      it "returns false" do
        expect(serialized_hash[:isSponsorSubscription]).to be(false)
      end
    end
  end

  describe "sponsorMetadata field" do
    context "when subscription is sponsor with metadata" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "sponsor",
          metadata: {
            "sponsor_code" => "TECH_CORP_2024",
            "sponsor_notes" => "Jane from TechCorp - YouTube sponsorship",
            "created_by" => "admin-123"
          }
        )
      end

      it "includes sponsor metadata" do
        expect(serialized_hash[:sponsorMetadata]).to be_present
        expect(serialized_hash[:sponsorMetadata][:sponsorCode]).to eq("TECH_CORP_2024")
        expect(serialized_hash[:sponsorMetadata][:sponsorNotes]).to eq("Jane from TechCorp - YouTube sponsorship")
        expect(serialized_hash[:sponsorMetadata][:createdBy]).to eq("admin-123")
      end
    end

    context "when subscription is sponsor without metadata" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "sponsor",
          metadata: {}
        )
      end

      it "returns sponsor metadata with nil values" do
        expect(serialized_hash[:sponsorMetadata]).to be_present
        expect(serialized_hash[:sponsorMetadata][:sponsorCode]).to be_nil
        expect(serialized_hash[:sponsorMetadata][:sponsorNotes]).to be_nil
        expect(serialized_hash[:sponsorMetadata][:createdBy]).to be_nil
      end
    end

    context "when subscription is not sponsor" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "paid",
          metadata: {}
        )
      end

      it "returns nil for sponsor metadata" do
        expect(serialized_hash[:sponsorMetadata]).to be_nil
      end
    end
  end

  describe "field name transformations for new fields" do
    context "when subscription is sponsor" do
      let(:space_subscription) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "sponsor",
          metadata: {
            "sponsor_code" => "CODE123",
            "sponsor_notes" => "Notes",
            "created_by" => "admin-123"
          }
        )
      end

      it "uses camelCase for sponsor-related fields" do
        expect(serialized_hash.keys).to include(
          :subscriptionType,
          :isSponsorSubscription,
          :sponsorMetadata
        )
        expect(serialized_hash.keys).not_to include(
          :subscription_type,
          :is_sponsor_subscription,
          :sponsor_metadata
        )
      end

      it "uses camelCase for sponsorMetadata sub-fields" do
        metadata = serialized_hash[:sponsorMetadata]
        expect(metadata).to be_present
        expect(metadata).to have_key(:sponsorCode)
        expect(metadata).to have_key(:sponsorNotes)
        expect(metadata).to have_key(:createdBy)
        expect(metadata).not_to have_key(:sponsor_code)
        expect(metadata).not_to have_key(:sponsor_notes)
        expect(metadata).not_to have_key(:created_by)
      end
    end
  end
end
