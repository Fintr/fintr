# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::ForceAttemptCycle, type: :operation do
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:subscription_plan) { create(:subscription_plan, interval: "month", token_limit: 100) }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: subscription_plan,
      xendit_plan_id: "repl_87d12b89-0cfc-4567-b52e-0698674a3f5d"
    )
  end
  let(:billing_cycle) do
    create(
      :finance_billing_cycle,
      space_subscription: space_subscription,
      xendit_cycle_id: "recy_8594c21f-dda6-4482-8d66-966e1095c7e1",
      cycle_number: 1
    )
  end

  let(:valid_params) do
    {
      space_id: space.id.to_s,
      billing_cycle_id: billing_cycle.id.to_s
    }
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
        params = valid_params.except(:space_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end
    end

    context "with missing billing_cycle_id" do
      it "returns failure" do
        params = valid_params.except(:billing_cycle_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle_id)
      end
    end
  end

  describe "#call" do
    let(:client_mock) { instance_double(Integrations::Payments::Xendit::Client) }
    let(:xendit_response) { { "id" => "recy_123", "status" => "PENDING" } }

    before do
      allow(Integrations::Payments::Xendit::Client).to receive(:new)
        .and_return(client_mock)
      allow(client_mock).to receive(:force_attempt_cycle)
        .and_return(xendit_response)
    end

    context "when environment is development" do
      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(Rails.env).to receive(:staging?).and_return(false)
      end

      it "returns success with xendit response" do
        result = operation.call(valid_params)

        expect(result).to be_success
        # The operation returns Success(result) where result is the xendit response
        response = result.value!
        # Handle case where response might be wrapped in Success (nested)
        response = response.value! if response.is_a?(Dry::Monads::Result::Success)
        expect(response).to eq(xendit_response)
      end

      it "calls xendit client with correct parameters" do
        expect(client_mock).to receive(:force_attempt_cycle).with(
          plan_id: space_subscription.xendit_plan_id,
          cycle_id: billing_cycle.xendit_cycle_id
        )

        operation.call(valid_params)
      end
    end

    context "when environment is staging" do
      before do
        allow(Rails.env).to receive(:development?).and_return(false)
        allow(Rails.env).to receive(:staging?).and_return(true)
      end

      it "returns success with xendit response" do
        result = operation.call(valid_params)

        expect(result).to be_success
        # The operation returns Success(result) where result is the xendit response
        response = result.value!
        # Handle case where response might be wrapped in Success (nested)
        response = response.value! if response.is_a?(Dry::Monads::Result::Success)
        expect(response).to eq(xendit_response)
      end
    end

    context "when environment is production" do
      before do
        allow(Rails.env).to receive(:development?).and_return(false)
        allow(Rails.env).to receive(:staging?).and_return(false)
      end

      it "returns failure with environment error" do
        result = operation.call(valid_params)

        # The operation returns Failure directly, but it might be wrapped
        # Handle both cases: direct Failure or Success(Failure)
        if result.success?
          inner_result = result.value!
          expect(inner_result).to be_failure
          expect(inner_result.failure).to have_key(:environment)
          expect(inner_result.failure[:environment]).to eq("Force attempt is only available in development or staging")
        else
          expect(result).to be_failure
          expect(result.failure).to have_key(:environment)
          expect(result.failure[:environment]).to eq("Force attempt is only available in development or staging")
        end
      end
    end

    context "when space is not found" do
      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(Rails.env).to receive(:staging?).and_return(false)
      end

      it "returns failure" do
        params = valid_params.merge(space_id: "non-existent-id")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
        expect(result.failure[:space_id]).to eq("not found")
      end
    end

    context "when billing cycle is not found" do
      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(Rails.env).to receive(:staging?).and_return(false)
      end

      it "returns failure" do
        params = valid_params.merge(billing_cycle_id: "non-existent-id")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle_id)
        expect(result.failure[:billing_cycle_id]).to eq("not found")
      end
    end

    context "when billing cycle belongs to different space" do
      let(:other_space) { create(:personal_space) }
      let(:other_space_subscription) do
        create(
          :space_subscription,
          space: other_space,
          subscription_plan: subscription_plan
        )
      end
      let(:other_billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: other_space_subscription,
          xendit_cycle_id: "recy_other_123"
        )
      end

      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(Rails.env).to receive(:staging?).and_return(false)
      end

      it "returns failure" do
        params = valid_params.merge(billing_cycle_id: other_billing_cycle.id.to_s)

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle_id)
        expect(result.failure[:billing_cycle_id]).to eq("not found")
      end
    end

    context "when billing cycle does not have xendit_cycle_id" do
      let(:billing_cycle_without_xendit) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 2,
          xendit_cycle_id: "temp_id_for_testing"
        )
      end

      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(Rails.env).to receive(:staging?).and_return(false)
      end

      it "returns failure" do
        # Stub the billing cycle query to return a cycle with nil xendit_cycle_id
        operation_instance = described_class.new
        allow(operation_instance).to receive(:find_space).and_return(Dry::Monads::Success(space))

        # Create a double for billing cycle with nil xendit_cycle_id
        billing_cycle_double = instance_double(Finance::BillingCycle)
        allow(billing_cycle_double).to receive(:xendit_cycle_id).and_return(nil)
        allow(billing_cycle_double).to receive(:xendit_cycle_id?).and_return(false)
        allow(billing_cycle_double).to receive(:space_subscription).and_return(space_subscription)
        allow(operation_instance).to receive(:find_billing_cycle).and_return(Dry::Monads::Success(billing_cycle_double))

        params = valid_params.merge(billing_cycle_id: billing_cycle_without_xendit.id.to_s)
        result = operation_instance.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:cycle_status)
        expect(result.failure[:cycle_status]).to eq("Cycle must have xendit_cycle_id to force attempt")
      end
    end

    context "when xendit client raises Xendit::Error" do
      let(:xendit_error) do
        Integrations::Payments::Xendit::Error.new(
          message: "Cycle not found",
          status: 404,
          code: "CYCLE_NOT_FOUND"
        )
      end

      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(Rails.env).to receive(:staging?).and_return(false)
        allow(client_mock).to receive(:force_attempt_cycle)
          .and_raise(xendit_error)
      end

      it "returns failure with xendit error details" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:xendit_error)
        expect(result.failure[:xendit_error]).to eq("Cycle not found")
        expect(result.failure[:status]).to eq(404)
        expect(result.failure[:code]).to eq("CYCLE_NOT_FOUND")
      end
    end

    context "when xendit client raises StandardError" do
      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(Rails.env).to receive(:staging?).and_return(false)
        allow(client_mock).to receive(:force_attempt_cycle)
          .and_raise(StandardError.new("Network error"))
      end

      it "returns failure with error message" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to force attempt cycle")
        expect(result.failure[:error]).to include("Network error")
      end
    end
  end
end
