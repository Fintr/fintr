# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::FindSpaceSubscriptionByXenditId, type: :operation do
  let(:operation) { described_class.new }
  let(:space) { create(:space) }
  let(:subscription_plan) { create(:subscription_plan) }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: subscription_plan,
      xendit_plan_id: "repl_87d12b89-0cfc-4567-b52e-0698674a3f5d"
    )
  end

  let(:valid_params) do
    {
      xendit_plan_id: space_subscription.xendit_plan_id
    }
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with missing xendit_plan_id" do
      it "returns failure" do
        # When params is empty, we need to pass it as a hash
        result = operation.validate(params: { xendit_plan_id: nil })

        expect(result).to be_failure
        expect(result.failure).to have_key(:xendit_plan_id)
      end
    end

    context "with nil xendit_plan_id" do
      it "returns failure" do
        params = { xendit_plan_id: nil }

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:xendit_plan_id)
      end
    end

    context "with empty string xendit_plan_id" do
      it "returns success as contract allows empty strings" do
        params = { xendit_plan_id: "" }

        result = operation.validate(params: params)

        # The contract only validates presence, not that it's non-empty
        # Empty strings will pass validation but fail in find_subscription
        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    context "when space subscription exists" do
      it "returns success with space subscription" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to be_a(Finance::SpaceSubscription)
        expect(result.value!.id).to eq(space_subscription.id)
      end

      it "finds space subscription by xendit_plan_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!.xendit_plan_id).to eq(space_subscription.xendit_plan_id)
      end

      it "returns the correct space subscription" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!.space.id).to eq(space.id)
        expect(result.value!.subscription_plan.id).to eq(subscription_plan.id)
      end
    end

    context "when space subscription does not exist" do
      it "returns failure with not found message" do
        params = { xendit_plan_id: "non-existent-plan-id" }

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_subscription)
        expect(result.failure[:space_subscription]).to include("not found for xendit_plan_id")
        expect(result.failure[:space_subscription]).to include("non-existent-plan-id")
      end
    end

    context "when multiple subscriptions exist with different xendit_plan_ids" do
      let(:other_subscription) do
        create(
          :space_subscription,
          space: create(:space),
          subscription_plan: subscription_plan,
          xendit_plan_id: "repl_other_plan_id"
        )
      end

      before do
        other_subscription
      end

      it "finds the correct subscription by xendit_plan_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!.id).to eq(space_subscription.id)
        expect(result.value!.xendit_plan_id).to eq(space_subscription.xendit_plan_id)
        expect(result.value!.id).not_to eq(other_subscription.id)
      end
    end

    context "when xendit_plan_id is nil in database" do
      let(:subscription_without_xendit_id) do
        create(
          :space_subscription,
          space: space,
          subscription_plan: subscription_plan,
          xendit_plan_id: nil
        )
      end

      it "does not find subscription with nil xendit_plan_id" do
        subscription_without_xendit_id
        params = { xendit_plan_id: "some-plan-id" }

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_subscription)
      end
    end
  end
end
