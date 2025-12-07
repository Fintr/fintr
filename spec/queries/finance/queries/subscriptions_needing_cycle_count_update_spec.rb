# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Queries::SubscriptionsNeedingCycleCountUpdate, type: :query do
  let(:current_time) { Time.zone.parse("2025-01-15 12:00:00") }
  let(:space) { create(:space) }
  let(:subscription_plan) { create(:subscription_plan) }

  before do
    Timecop.freeze(current_time)
  end

  after do
    Timecop.return
  end

  describe "#call" do
    context "when subscription has paid cycle coinciding with current timestamp" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:paid_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "paid",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-01-01 00:00:00"),
          xendit_cycle_id: "cycle-1"
        )
      end

      it "returns a success" do
        result = described_class.call(params: { current_time: })

        expect(result).to be_success
      end

      it "includes the subscription in results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).to include(subscription.id)
      end

      it "includes max_cycle_number in the result" do
        result = described_class.call(params: { current_time: })

        subscription_result = result.value!.find { |s| s.id == subscription.id }
        expect(subscription_result.max_cycle_number).to eq(1)
      end
    end

    context "when subscription has current_cycle_count equal to paid cycle number" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 1
        )
      end

      let!(:paid_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "paid",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-01-01 00:00:00"),
          xendit_cycle_id: "cycle-1"
        )
      end

      it "excludes the subscription from results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).not_to include(subscription.id)
      end
    end

    context "when subscription has current_cycle_count higher than paid cycle number" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 2
        )
      end

      let!(:paid_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "paid",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-01-01 00:00:00"),
          xendit_cycle_id: "cycle-1"
        )
      end

      it "excludes the subscription from results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).not_to include(subscription.id)
      end
    end

    context "when subscription has zero current_cycle_count" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:paid_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "paid",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-01-01 00:00:00"),
          xendit_cycle_id: "cycle-1"
        )
      end

      it "includes the subscription in results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).to include(subscription.id)
      end
    end

    context "when subscription has pending cycle" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:pending_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "pending",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "excludes the subscription from results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).not_to include(subscription.id)
      end
    end

    context "when subscription has failed cycle" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:failed_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "failed",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          xendit_cycle_id: "cycle-1"
        )
      end

      it "excludes the subscription from results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).not_to include(subscription.id)
      end
    end

    context "when subscription has paid cycle in the past" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:past_paid_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "paid",
          span: (Time.zone.parse("2024-12-01 00:00:00")..Time.zone.parse("2024-12-31 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2024-12-01 00:00:00"),
          xendit_cycle_id: "cycle-1"
        )
      end

      it "excludes the subscription from results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).not_to include(subscription.id)
      end
    end

    context "when subscription has paid cycle in the future" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:future_paid_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 2,
          status: "paid",
          span: (Time.zone.parse("2025-02-01 00:00:00")..Time.zone.parse("2025-02-28 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-02-01 00:00:00"),
          xendit_cycle_id: "cycle-2"
        )
      end

      it "excludes the subscription from results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).not_to include(subscription.id)
      end
    end

    context "when subscription has multiple paid cycles" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:paid_cycle_1) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "paid",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-01-01 00:00:00"),
          xendit_cycle_id: "cycle-1"
        )
      end

      let!(:paid_cycle_2) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 2,
          status: "paid",
          span: (Time.zone.parse("2025-01-10 00:00:00")..Time.zone.parse("2025-01-20 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-01-10 00:00:00"),
          xendit_cycle_id: "cycle-2"
        )
      end

      it "includes the subscription in results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).to include(subscription.id)
      end

      it "returns the maximum cycle number" do
        result = described_class.call(params: { current_time: })

        subscription_result = result.value!.find { |s| s.id == subscription.id }
        expect(subscription_result.max_cycle_number).to eq(2)
      end
    end

    context "when subscription has no cycles" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      it "excludes the subscription from results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).not_to include(subscription.id)
      end
    end

    context "when no subscriptions need updates" do
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 1
        )
      end

      it "returns an empty result" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions).to be_empty
      end
    end

    context "when custom current_time is provided" do
      let(:custom_time) { Time.zone.parse("2025-02-15 12:00:00") }
      let!(:subscription) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:paid_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          status: "paid",
          span: (Time.zone.parse("2025-02-01 00:00:00")..Time.zone.parse("2025-02-28 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-02-01 00:00:00"),
          xendit_cycle_id: "cycle-1"
        )
      end

      it "uses the custom time for filtering" do
        result = described_class.call(params: { current_time: custom_time })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).to include(subscription.id)
      end
    end

    context "when multiple subscriptions need updates" do
      let(:space2) { create(:space) }
      let(:subscription_plan2) { create(:subscription_plan, :standard) }

      let!(:subscription1) do
        create(
          :space_subscription,
          space:,
          subscription_plan:,
          current_cycle_count: 0
        )
      end

      let!(:subscription2) do
        create(
          :space_subscription,
          space: space2,
          subscription_plan: subscription_plan2,
          current_cycle_count: 1
        )
      end

      let!(:paid_cycle_1) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription1,
          cycle_number: 1,
          status: "paid",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-01-01 00:00:00"),
          xendit_cycle_id: "cycle-1"
        )
      end

      let!(:paid_cycle_2) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription2,
          cycle_number: 2,
          status: "paid",
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59")),
          tokens_allocated: 100,
          paid_at: Time.zone.parse("2025-01-01 00:00:00"),
          xendit_cycle_id: "cycle-2"
        )
      end

      it "includes both subscriptions in results" do
        result = described_class.call(params: { current_time: })

        subscriptions = result.value!
        expect(subscriptions.map(&:id)).to contain_exactly(subscription1.id, subscription2.id)
      end

      it "returns correct max_cycle_number for each subscription" do
        result = described_class.call(params: { current_time: })

        subscription1_result = result.value!.find { |s| s.id == subscription1.id }
        subscription2_result = result.value!.find { |s| s.id == subscription2.id }

        expect(subscription1_result.max_cycle_number).to eq(1)
        expect(subscription2_result.max_cycle_number).to eq(2)
      end
    end
  end

  describe "#join_paid_cycles" do
    let(:query) { described_class.new }
    let(:relation) { Finance::SpaceSubscription.all }

    it "returns a success" do
      result = query.send(:join_paid_cycles, relation)

      expect(result).to be_success
    end

    it "joins with paid cycles subquery" do
      result = query.send(:join_paid_cycles, relation)

      expect(result.value!.to_sql).to include("paid_cycles")
    end
  end

  describe "#where_needs_update" do
    let(:query) { described_class.new }
    let(:relation) { Finance::SpaceSubscription.all }

    before do
      # Create a mock relation with the join already applied
      allow(relation).to receive(:where).and_return(relation)
    end

    it "returns a success" do
      result = query.send(:where_needs_update, relation)

      expect(result).to be_success
    end
  end

  describe "#select_fields" do
    let(:query) { described_class.new }
    let(:relation) { Finance::SpaceSubscription.all }

    it "returns a success" do
      result = query.send(:select_fields, relation)

      expect(result).to be_success
    end

    it "selects subscription fields and max_cycle_number" do
      result = query.send(:select_fields, relation)

      expect(result.value!.select_values).to include(
        "finance_space_subscriptions.*",
        "paid_cycles.max_cycle_number"
      )
    end
  end
end
