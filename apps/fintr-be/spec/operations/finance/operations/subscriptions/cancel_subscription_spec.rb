# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::CancelSubscription, type: :operation do
  let(:operation) { described_class.new }
  let(:space) { create(:space) }
  let(:space_subscription) do
    create(
      :space_subscription,
      :active,
      space: space,
      xendit_plan_id: "repl_87d12b89-0cfc-4567-b52e-0698674a3f5d",
      metadata: { existing_key: "existing_value" }
    )
  end

  let(:valid_params) do
    {
      space_id: space.id.to_s,
      subscription_id: space_subscription.id.to_s
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

    context "with missing subscription_id" do
      it "returns failure" do
        params = valid_params.except(:subscription_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_id)
      end
    end
  end

  describe "#call" do
    let(:xendit_client) { instance_double(Integrations::Payments::Xendit::Client) }
    let(:xendit_response) do
      {
        id: space_subscription.xendit_plan_id,
        status: "INACTIVE"
      }
    end

    before do
      allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(xendit_client)
      allow(xendit_client).to receive(:deactivate_subscription_plan)
        .and_return(xendit_response)
    end

    context "with valid parameters" do
      it "returns success with reloaded space subscription" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to be_a(Finance::SpaceSubscription)
        expect(result.value!.id).to eq(space_subscription.id)
      end

      it "finds space by space_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!.space.id).to eq(space.id)
      end

      it "finds space subscription by subscription_id and space_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!.id).to eq(space_subscription.id)
        expect(result.value!.space_id).to eq(space.id)
      end

      it "deactivates Xendit subscription plan" do
        expect(xendit_client).to receive(:deactivate_subscription_plan)
          .with(plan_id: space_subscription.xendit_plan_id)

        operation.call(valid_params)
      end

      it "updates space subscription status to inactive" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
      end

      it "sets cancelled_at timestamp" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.cancelled_at).to be_present
        expect(space_subscription.cancelled_at).to be_within(1.second).of(Time.zone.now)
      end

      it "merges xendit_response into metadata" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["existing_key"]).to eq("existing_value")
        expect(space_subscription.metadata["id"]).to eq(xendit_response[:id])
        expect(space_subscription.metadata["status"]).to eq(xendit_response[:status])
      end

      it "does not set ended_at" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.ended_at).to be_nil
      end
    end

    context "when space is not found" do
      it "returns failure" do
        params = valid_params.merge(space_id: "non-existent-id")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
        expect(result.failure[:space_id]).to eq("not found")
      end
    end

    context "when space subscription is not found" do
      it "returns failure when subscription_id does not exist" do
        params = valid_params.merge(subscription_id: "non-existent-id")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_id)
        expect(result.failure[:subscription_id]).to eq("not found")
      end

      it "returns failure when subscription belongs to different space" do
        other_space = create(:space)
        params = valid_params.merge(space_id: other_space.id.to_s)

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_id)
        expect(result.failure[:subscription_id]).to eq("not found")
      end
    end

    context "when subscription is already inactive" do
      let(:inactive_subscription_plan) { create(:subscription_plan, slug: "inactive-plan-#{SecureRandom.uuid}") }
      let(:inactive_subscription) do
        create(
          :space_subscription,
          :inactive,
          space: space,
          subscription_plan: inactive_subscription_plan,
          xendit_plan_id: "repl_inactive_plan"
        )
      end
      let(:params_with_inactive) do
        {
          space_id: space.id.to_s,
          subscription_id: inactive_subscription.id.to_s
        }
      end

      it "returns failure" do
        result = operation.call(params_with_inactive)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
        expect(result.failure[:subscription]).to eq("already inactive")
      end

      it "does not call Xendit client" do
        expect(xendit_client).not_to receive(:deactivate_subscription_plan)

        operation.call(params_with_inactive)
      end
    end

    context "when Xendit API returns INELIGIBLE_DEACTIVATION error" do
      it "returns success with ineligible_deactivation flag" do
        allow(xendit_client).to receive(:deactivate_subscription_plan)
          .and_raise(
            Integrations::Payments::Xendit::Error.new(
              message: "Cannot deactivate",
              status: 422,
              code: "INELIGIBLE_DEACTIVATION"
            )
          )

        result = operation.call(valid_params)

        expect(result).to be_success
        # The operation should still update the subscription
        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
        expect(space_subscription.cancelled_at).to be_present
      end
    end

    context "when Xendit API returns other error" do
      it "returns failure with Xendit error details" do
        allow(xendit_client).to receive(:deactivate_subscription_plan)
          .and_raise(
            Integrations::Payments::Xendit::Error.new(
              message: "Plan not found",
              status: 404,
              code: "PLAN_NOT_FOUND"
            )
          )

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:xendit_error)
        expect(result.failure[:xendit_error]).to eq("Plan not found")
        expect(result.failure[:status]).to eq(404)
        expect(result.failure[:code]).to eq("PLAN_NOT_FOUND")
      end

      it "does not update space subscription" do
        original_status = space_subscription.status
        allow(xendit_client).to receive(:deactivate_subscription_plan)
          .and_raise(
            Integrations::Payments::Xendit::Error.new(
              message: "Plan not found",
              status: 404,
              code: "PLAN_NOT_FOUND"
            )
          )

        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.status).to eq(original_status)
        expect(space_subscription.cancelled_at).to be_nil
      end
    end

    context "when Xendit API raises StandardError" do
      it "returns failure with error message" do
        allow(xendit_client).to receive(:deactivate_subscription_plan)
          .and_raise(StandardError.new("Network error"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to deactivate Xendit subscription")
        expect(result.failure[:error]).to include("Network error")
      end
    end

    context "when updating space subscription fails" do
      it "returns failure when record is invalid" do
        # Stub the class method to return an instance that raises on update!
        invalid_record = space_subscription.dup
        allow(Finance::SpaceSubscription).to receive(:find_by).and_return(space_subscription)
        allow(space_subscription).to receive(:update!).and_raise(
          ActiveRecord::RecordInvalid.new(invalid_record)
        )

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_subscription)
      end

      it "returns failure when update raises StandardError" do
        # Stub the class method to return an instance that raises on update!
        allow(Finance::SpaceSubscription).to receive(:find_by).and_return(space_subscription)
        allow(space_subscription).to receive(:update!).and_raise(StandardError.new("Database error"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to update space subscription")
        expect(result.failure[:error]).to include("Database error")
      end
    end

    context "when xendit_response is a hash with string keys" do
      let(:xendit_response) do
        {
          "id" => space_subscription.xendit_plan_id,
          "status" => "INACTIVE",
          "additional_data" => "value"
        }
      end

      it "merges response into metadata" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["id"]).to eq(xendit_response["id"])
        expect(space_subscription.metadata["status"]).to eq(xendit_response["status"])
        expect(space_subscription.metadata["additional_data"]).to eq(xendit_response["additional_data"])
      end
    end

    context "when metadata already has data" do
      let(:space_subscription) do
        create(
          :space_subscription,
          :active,
          space: space,
          xendit_plan_id: "repl_87d12b89-0cfc-4567-b52e-0698674a3f5d",
          metadata: {
            existing_key: "existing_value",
            another_key: "another_value"
          }
        )
      end

      it "preserves existing metadata and merges xendit_response" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["existing_key"]).to eq("existing_value")
        expect(space_subscription.metadata["another_key"]).to eq("another_value")
        expect(space_subscription.metadata["id"]).to eq(xendit_response[:id])
        expect(space_subscription.metadata["status"]).to eq(xendit_response[:status])
      end
    end
  end
end
