# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::Webhooks::HandlePlanActivated, type: :operation do
  let(:operation) { described_class.new }
  let(:space_subscription) do
    create(
      :space_subscription,
      xendit_plan_id: "repl_dfc34fae-b4b1-4d7a-afad-6ad3b0a9f180",
      status: "pending",
      metadata: { existing_key: "existing_value" }
    )
  end

  let(:valid_params) do
    {
      id: space_subscription.xendit_plan_id,
      status: "ACTIVE",
      reference_id: "sub-f42d2d60-7822-4047-8bf8-655337d2cd40",
      customer_id: "cust-f952f3b5-0fb4-408a-aa5a-175fedd8a918",
      schedule_id: "resc_11857d7f-c2b8-4cd6-b515-57d51269a975",
      schedule: {
        reference_id: "schedule-3755788a-523d-4651-85d8-67259995a8c7",
        id: "resc_11857d7f-c2b8-4cd6-b515-57d51269a975"
      },
      payment_methods: [
        {
          payment_method_id: "pm-9a21c227-7948-4217-852a-3627e6b7ac54",
          rank: 1,
          type: "EWALLET"
        }
      ],
      actions: [
        {
          url: "https://linking-dev.xendit.co/pali_5959a718-cdac-4265-8f8b-cdd10d30661e",
          action: "AUTH",
          method: "GET",
          url_type: "WEB"
        }
      ]
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
      it "returns success when status is present" do
        params = valid_params.merge(status: "ACTIVE")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when status is nil" do
        params = valid_params.merge(status: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when payment_methods is present" do
        params = valid_params.merge(
          payment_methods: [
            { payment_method_id: "pm-123", rank: 1, type: "EWALLET" }
          ]
        )

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when action_url is present" do
        params = valid_params.merge(action_url: "https://example.com/action")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when actions array is present" do
        params = valid_params.merge(
          actions: [
            {
              url: "https://example.com/action",
              action: "AUTH"
            }
          ]
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
        expect(response[:message]).to eq("Plan activated")
      end

      it "finds space subscription by xendit_plan_id" do
        expect(find_space_subscription_operation).to receive(:call)
          .with(xendit_plan_id: space_subscription.xendit_plan_id)

        operation.call(valid_params)
      end

      it "updates subscription status to active" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end

      it "sets started_at" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.started_at).to be_present
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
        expect(space_subscription.metadata["status"]).to eq(valid_params[:status])
      end

      it "stores customer_id in metadata" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["customer_id"]).to eq(valid_params[:customer_id])
      end

      it "does not store payment_methods in metadata when not in contract" do
        # Note: payment_methods is not in the contract, so it gets filtered out during validation
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["payment_methods"]).to be_nil
      end

      it "stores action_url from actions array when present" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["action_url"]).to eq(
          valid_params[:actions].first[:url]
        )
      end
    end

    context "when mapping Xendit status to our status" do
      it "maps ACTIVE to active" do
        params = valid_params.merge(status: "ACTIVE")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end

      it "maps SCHEDULED to active" do
        params = valid_params.merge(status: "SCHEDULED")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end

      it "maps INACTIVE to inactive" do
        params = valid_params.merge(status: "INACTIVE")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
      end

      it "maps STOPPED to inactive" do
        params = valid_params.merge(status: "STOPPED")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
      end

      it "maps REQUIRES_ACTION to requires_action" do
        params = valid_params.merge(status: "REQUIRES_ACTION")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("requires_action")
      end

      it "maps PENDING to pending" do
        params = valid_params.merge(status: "PENDING")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("pending")
      end

      it "defaults to active when status is nil" do
        params = valid_params.merge(status: nil)

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end

      it "defaults to active when status is unknown" do
        params = valid_params.merge(status: "UNKNOWN_STATUS")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end

      it "handles lowercase status" do
        params = valid_params.merge(status: "active")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end
    end

    context "when schedule_id is provided without schedule hash" do
      it "stores schedule_id in metadata" do
        params = valid_params.except(:schedule)

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.metadata["schedule_id"]).to eq(params[:schedule_id])
      end
    end

    context "when action_url is provided directly" do
      it "stores action_url in metadata" do
        params = valid_params.except(:actions).merge(action_url: "https://example.com/action")

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.metadata["action_url"]).to eq("https://example.com/action")
      end
    end

    context "when actions array has url" do
      it "stores action_url from actions array url field" do
        params = valid_params.merge(
          actions: [
            {
              url: "https://example.com/redirect",
              action: "AUTH"
            }
          ]
        )

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.metadata["action_url"]).to eq("https://example.com/redirect")
      end
    end

    context "when action_url takes precedence over actions array" do
      it "uses action_url when both are provided" do
        params = valid_params.merge(
          action_url: "https://example.com/direct-action",
          actions: [
            {
              url: "https://example.com/actions-url",
              action: "AUTH"
            }
          ]
        )

        operation.call(params)

        space_subscription.reload
        expect(space_subscription.metadata["action_url"]).to eq("https://example.com/direct-action")
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
        expect(space_subscription.status).to eq("active")
        expect(space_subscription.started_at).to be_present
      end

      it "does not set xendit_reference_id when not provided" do
        original_reference_id = space_subscription.xendit_reference_id
        operation.call(minimal_params)

        space_subscription.reload
        expect(space_subscription.xendit_reference_id).to eq(original_reference_id)
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
