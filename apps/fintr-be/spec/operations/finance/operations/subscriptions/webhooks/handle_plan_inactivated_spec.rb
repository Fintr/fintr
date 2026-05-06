# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::Webhooks::HandlePlanInactivated, type: :operation do
  let(:operation) { described_class.new }
  let(:space_subscription) do
    create(
      :space_subscription,
      xendit_plan_id: "repl_dfc34fae-b4b1-4d7a-afad-6ad3b0a9f180",
      status: "active",
      metadata: { existing_key: "existing_value" }
    )
  end

  let(:valid_params) do
    {
      id: space_subscription.xendit_plan_id,
      reference_id: "sub-f42d2d60-7822-4047-8bf8-655337d2cd40",
      customer_id: "cust-f952f3b5-0fb4-408a-aa5a-175fedd8a918",
      schedule_id: "resc_11857d7f-c2b8-4cd6-b515-57d51269a975",
      schedule: {
        reference_id: "schedule-3755788a-523d-4651-85d8-67259995a8c7",
        id: "resc_11857d7f-c2b8-4cd6-b515-57d51269a975"
      }
    }
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with missing id" do
      it "returns failure" do
        params = valid_params.except(:id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:id)
      end
    end

    context "with optional fields" do
      it "returns success when reference_id is present" do
        params = valid_params.merge(reference_id: "ref-123")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when reference_id is nil" do
        params = valid_params.merge(reference_id: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when customer_id is present" do
        params = valid_params.merge(customer_id: "cust-123")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when customer_id is nil" do
        params = valid_params.merge(customer_id: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when schedule_id is present" do
        params = valid_params.merge(schedule_id: "schedule-123")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when schedule hash is present" do
        params = valid_params.merge(
          schedule: {
            reference_id: "schedule-ref-123"
          }
        )

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    let(:find_space_subscription_operation) do
      instance_double(Finance::Operations::Subscriptions::FindSpaceSubscriptionByXenditId)
    end

    before do
      allow(Finance::Operations::Subscriptions::FindSpaceSubscriptionByXenditId).to receive(:new)
        .and_return(find_space_subscription_operation)
      allow(find_space_subscription_operation).to receive(:call)
        .and_return(Dry::Monads::Success(space_subscription))
    end

    context "with valid parameters" do
      it "returns success with subscription_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:subscription_id]).to eq(space_subscription.id)
        expect(response[:message]).to eq("Plan inactivated")
      end

      it "finds space subscription by xendit_plan_id" do
        expect(find_space_subscription_operation).to receive(:call)
          .with(xendit_plan_id: space_subscription.xendit_plan_id)

        operation.call(valid_params)
      end

      it "updates subscription status to inactive" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
      end

      it "sets ended_at" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.ended_at).to be_present
      end

      it "sets cancelled_at" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.cancelled_at).to be_present
      end

      it "updates xendit_reference_id when provided" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.xendit_reference_id).to eq(valid_params[:reference_id])
      end

      it "updates xendit_schedule_reference_id from schedule hash" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.xendit_schedule_reference_id).to eq(
          valid_params.dig(:schedule, :reference_id)
        )
      end

      it "merges metadata correctly" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["existing_key"]).to eq("existing_value")
        expect(space_subscription.metadata["id"]).to eq(valid_params[:id])
        expect(space_subscription.metadata["reference_id"]).to eq(valid_params[:reference_id])
      end

      it "stores customer_id in metadata when provided" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["customer_id"]).to eq(valid_params[:customer_id])
      end
    end

    context "when schedule_id is provided without schedule hash" do
      let(:params_with_schedule_id) do
        valid_params.except(:schedule).merge(schedule_id: "schedule-123")
      end

      it "stores schedule_id in metadata" do
        operation.call(params_with_schedule_id)

        space_subscription.reload
        expect(space_subscription.metadata["schedule_id"]).to eq("schedule-123")
      end

      it "does not set xendit_schedule_reference_id" do
        original_schedule_ref_id = space_subscription.xendit_schedule_reference_id

        operation.call(params_with_schedule_id)

        space_subscription.reload
        expect(space_subscription.xendit_schedule_reference_id).to eq(original_schedule_ref_id)
      end
    end

    context "when schedule hash reference_id takes precedence over schedule_id" do
      let(:params_with_both) do
        valid_params.merge(schedule_id: "schedule-123")
      end

      it "uses schedule reference_id for xendit_schedule_reference_id" do
        operation.call(params_with_both)

        space_subscription.reload
        expect(space_subscription.xendit_schedule_reference_id).to eq(
          valid_params.dig(:schedule, :reference_id)
        )
      end
    end

    context "when optional fields are not provided" do
      let(:minimal_params) do
        {
          id: space_subscription.xendit_plan_id
        }
      end

      it "updates subscription with minimal attributes" do
        operation.call(minimal_params)

        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
        expect(space_subscription.ended_at).to be_present
        expect(space_subscription.cancelled_at).to be_present
      end

      it "does not set xendit_reference_id when not provided" do
        original_reference_id = space_subscription.xendit_reference_id

        operation.call(minimal_params)

        space_subscription.reload
        expect(space_subscription.xendit_reference_id).to eq(original_reference_id)
      end

      it "does not set customer_id in metadata when not provided" do
        operation.call(minimal_params)

        space_subscription.reload
        expect(space_subscription.metadata["customer_id"]).to be_nil
      end
    end

    context "when space subscription is not found" do
      it "returns failure" do
        allow(find_space_subscription_operation).to receive(:call)
          .and_return(Dry::Monads::Failure(space_subscription: "not found"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_subscription)
      end
    end

    context "when update fails" do
      it "raises error" do
        allow(space_subscription).to receive(:update!).and_raise(
          ActiveRecord::RecordInvalid.new(space_subscription)
        )

        expect { operation.call(valid_params) }.to raise_error(ActiveRecord::RecordInvalid)
      end
    end
  end
end
