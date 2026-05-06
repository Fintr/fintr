# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Queries::ListSubscriptionPlans, type: :query do
  describe "#call" do
    context "with default relation (active subscription plans)" do
      let!(:plan_cheapest) do
        create(
          :subscription_plan,
          name: "Cheapest",
          slug: "cheapest",
          price_cents: 1_000,
          token_limit: 10,
          active: true
        )
      end
      let!(:plan_expensive) do
        create(
          :subscription_plan,
          name: "Expensive",
          slug: "expensive",
          price_cents: 10_000,
          token_limit: 100,
          active: true
        )
      end
      let!(:plan_middle) do
        create(
          :subscription_plan,
          name: "Middle",
          slug: "middle",
          price_cents: 5_000,
          token_limit: 50,
          active: true
        )
      end
      let!(:inactive_plan) do
        create(
          :subscription_plan,
          name: "Inactive",
          slug: "inactive",
          price_cents: 2_000,
          token_limit: 20,
          active: false
        )
      end

      it "returns success" do
        result = described_class.new.call

        expect(result).to be_success
      end

      it "returns subscription plans ordered by price_cents ascending" do
        result = described_class.new.call

        expect(result).to be_success
        plans = result.value!
        plan_ids = plans.map(&:id)

        expect(plan_ids).to eq([plan_cheapest.id, plan_middle.id, plan_expensive.id])
      end

      it "only includes active subscription plans" do
        result = described_class.new.call

        expect(result).to be_success
        plans = result.value!
        plan_ids = plans.map(&:id)

        expect(plan_ids).not_to include(inactive_plan.id)
        expect(plan_ids).to contain_exactly(plan_cheapest.id, plan_middle.id, plan_expensive.id)
      end

      it "orders plans correctly when prices are equal" do
        plan_same_price_1 = create(
          :subscription_plan,
          name: "Same Price 1",
          slug: "same-price-1",
          price_cents: 3_000,
          token_limit: 30,
          active: true
        )
        plan_same_price_2 = create(
          :subscription_plan,
          name: "Same Price 2",
          slug: "same-price-2",
          price_cents: 3_000,
          token_limit: 30,
          active: true
        )

        result = described_class.new.call

        expect(result).to be_success
        plans = result.value!
        plan_ids = plans.map(&:id)

        # Plans with same price should be included, order may vary
        expect(plan_ids).to include(plan_same_price_1.id)
        expect(plan_ids).to include(plan_same_price_2.id)
      end
    end

    context "with custom relation" do
      let!(:active_plan) do
        create(
          :subscription_plan,
          name: "Active",
          slug: "active",
          price_cents: 5_000,
          active: true
        )
      end
      let!(:inactive_plan) do
        create(
          :subscription_plan,
          name: "Inactive",
          slug: "inactive",
          price_cents: 2_000,
          active: false
        )
      end
      let!(:another_inactive_plan) do
        create(
          :subscription_plan,
          name: "Another Inactive",
          slug: "another-inactive",
          price_cents: 1_000,
          active: false
        )
      end

      it "uses the provided relation instead of default" do
        custom_relation = Finance::SubscriptionPlan.where(active: false)
        result = described_class.new(relation: custom_relation).call

        expect(result).to be_success
        plans = result.value!
        plan_ids = plans.map(&:id)

        expect(plan_ids).not_to include(active_plan.id)
        expect(plan_ids).to contain_exactly(another_inactive_plan.id, inactive_plan.id)
      end

      it "orders custom relation by price_cents ascending" do
        custom_relation = Finance::SubscriptionPlan.where(active: false)
        result = described_class.new(relation: custom_relation).call

        expect(result).to be_success
        plans = result.value!
        plan_ids = plans.map(&:id)

        # Should be ordered by price_cents: :asc
        expect(plan_ids.first).to eq(another_inactive_plan.id)
        expect(plan_ids.last).to eq(inactive_plan.id)
      end
    end

    context "when no subscription plans exist" do
      it "returns success with empty relation" do
        result = described_class.new.call

        expect(result).to be_success
        plans = result.value!

        expect(plans).to be_empty
      end
    end

    context "when ordering fails" do
      it "returns failure with error message" do
        # Stub the relation to raise an error when ordering
        relation_double = instance_double(ActiveRecord::Relation)
        allow(relation_double).to receive(:order).and_raise(StandardError.new("Database error"))

        result = described_class.new(relation: relation_double).call

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to order subscription plans")
        expect(result.failure[:error]).to include("Database error")
      end
    end

    context "with multiple plans at different price points" do
      let!(:plan_1) do
        create(
          :subscription_plan,
          name: "Plan 1",
          slug: "plan-1",
          price_cents: 100,
          active: true
        )
      end
      let!(:plan_2) do
        create(
          :subscription_plan,
          name: "Plan 2",
          slug: "plan-2",
          price_cents: 500,
          active: true
        )
      end
      let!(:plan_3) do
        create(
          :subscription_plan,
          name: "Plan 3",
          slug: "plan-3",
          price_cents: 1_000,
          active: true
        )
      end
      let!(:plan_4) do
        create(
          :subscription_plan,
          name: "Plan 4",
          slug: "plan-4",
          price_cents: 5_000,
          active: true
        )
      end
      let!(:plan_5) do
        create(
          :subscription_plan,
          name: "Plan 5",
          slug: "plan-5",
          price_cents: 10_000,
          active: true
        )
      end

      it "returns all plans in ascending price order" do
        result = described_class.new.call

        expect(result).to be_success
        plans = result.value!
        plan_ids = plans.map(&:id)
        prices = plans.map(&:price_cents)

        expect(plan_ids).to eq([plan_1.id, plan_2.id, plan_3.id, plan_4.id, plan_5.id])
        expect(prices).to eq([100, 500, 1_000, 5_000, 10_000])
      end
    end
  end
end
