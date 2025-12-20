# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::GetCurrentSubscriptions, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:subscription_plan) { create(:subscription_plan, slug: "basic-#{SecureRandom.hex(4)}", token_limit: 50, price_cents: 14_900, interval: "month") }

  let(:valid_params) do
    {
      space_id: space.id.to_s
    }
  end

  before do
    create(:space_user, space:, user:)
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with missing space_id" do
      it "returns failure" do
        params = { space_id: nil }

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end
    end
  end

  describe "#call" do
    context "with valid parameters" do
      it "returns success with subscriptions array" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to be_an(Array)
      end

      it "finds space by space_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
      end

      context "when space has active subscriptions" do
        let!(:active_subscription) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "active"
          )
        end

        it "returns active subscription" do
          result = operation.call(valid_params)

          expect(result).to be_success
          subscriptions = result.value!
          expect(subscriptions).to include(active_subscription)
        end
      end

      context "when space has pending subscriptions" do
        let!(:pending_subscription) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "pending"
          )
        end

        it "returns pending subscription" do
          result = operation.call(valid_params)

          expect(result).to be_success
          subscriptions = result.value!
          expect(subscriptions).to include(pending_subscription)
        end
      end

      context "when space has requires_action subscriptions" do
        let!(:requires_action_subscription) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "requires_action"
          )
        end

        it "returns requires_action subscription" do
          result = operation.call(valid_params)

          expect(result).to be_success
          subscriptions = result.value!
          expect(subscriptions).to include(requires_action_subscription)
        end
      end

      context "when space has inactive subscriptions with billing cycles" do
        let!(:inactive_subscription_with_cycles) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "inactive"
          )
        end

        before do
          create(
            :finance_billing_cycle,
            space_subscription: inactive_subscription_with_cycles,
            cycle_number: 1,
            status: "paid"
          )
        end

        it "returns inactive subscription with billing cycles" do
          result = operation.call(valid_params)

          expect(result).to be_success
          subscriptions = result.value!
          expect(subscriptions).to include(inactive_subscription_with_cycles)
        end
      end

      context "when space has inactive subscriptions without billing cycles" do
        let!(:inactive_subscription_without_cycles) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "inactive"
          )
        end

        it "does not return inactive subscription without billing cycles" do
          result = operation.call(valid_params)

          expect(result).to be_success
          subscriptions = result.value!
          expect(subscriptions).not_to include(inactive_subscription_without_cycles)
        end
      end

      context "when space has multiple subscriptions" do
        let!(:active_subscription) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "active",
            created_at: 2.days.ago
          )
        end
        let!(:pending_subscription) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "pending",
            created_at: 1.day.ago
          )
        end
        let!(:inactive_subscription_with_cycles) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "inactive",
            created_at: 3.days.ago
          )
        end
        let!(:inactive_subscription_without_cycles) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "inactive",
            created_at: 4.days.ago
          )
        end

        before do
          create(
            :finance_billing_cycle,
            space_subscription: inactive_subscription_with_cycles,
            cycle_number: 1,
            status: "paid"
          )
        end

        it "returns subscriptions ordered by created_at desc" do
          result = operation.call(valid_params)

          expect(result).to be_success
          subscriptions = result.value!
          expect(subscriptions.length).to eq(3)
          expect(subscriptions).to include(active_subscription)
          expect(subscriptions).to include(pending_subscription)
          expect(subscriptions).to include(inactive_subscription_with_cycles)
          expect(subscriptions).not_to include(inactive_subscription_without_cycles)

          # Check ordering (most recent first)
          expect(subscriptions.first).to eq(pending_subscription)
          expect(subscriptions.second).to eq(active_subscription)
          expect(subscriptions.third).to eq(inactive_subscription_with_cycles)
        end
      end

      context "when space has subscriptions from different spaces" do
        let(:other_space) { create(:personal_space) }
        let!(:space_subscription) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: subscription_plan,
            status: "active"
          )
        end
        let!(:other_space_subscription) do
          create(
            :space_subscription,
            space: other_space,
            subscription_plan: subscription_plan,
            status: "active"
          )
        end

        it "only returns subscriptions for the specified space" do
          result = operation.call(valid_params)

          expect(result).to be_success
          subscriptions = result.value!
          expect(subscriptions).to include(space_subscription)
          expect(subscriptions).not_to include(other_space_subscription)
        end
      end
    end

    context "with invalid parameters" do
      it "returns failure when space_id is invalid" do
        params = valid_params.merge(space_id: "invalid")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end
    end

    context "when space is not found" do
      it "returns failure" do
        params = valid_params.merge(space_id: "999999")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
        expect(result.failure[:space_id]).to eq("not found")
      end
    end
  end
end
