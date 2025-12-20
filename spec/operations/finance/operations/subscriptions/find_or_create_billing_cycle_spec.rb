# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::FindOrCreateBillingCycle, type: :operation do
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:subscription_plan) { create(:subscription_plan, interval: "month", token_limit: 100) }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: subscription_plan
    )
  end

  let(:cycle_number) { 1 }
  let(:started_at) { Time.zone.parse("2025-01-15 10:00:00").to_datetime }
  let(:xendit_cycle_id) { "recy_8594c21f-dda6-4482-8d66-966e1095c7e1" }
  let(:scheduled_timestamp) { Time.zone.parse("2025-01-15 10:00:00").to_datetime }
  let(:metadata) { { "key" => "value" } }

  let(:valid_params) do
    {
      space_subscription: space_subscription,
      cycle_number: cycle_number,
      started_at: started_at,
      xendit_cycle_id: xendit_cycle_id,
      scheduled_timestamp: scheduled_timestamp,
      metadata: metadata
    }
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with missing space_subscription" do
      it "returns failure" do
        params = valid_params.except(:space_subscription)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_subscription)
      end
    end

    context "with optional fields" do
      it "returns success when only space_subscription is provided" do
        params = { space_subscription: space_subscription }

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with xendit_cycle_id" do
        params = valid_params.merge(xendit_cycle_id: "recy_123")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with cycle_number" do
        params = valid_params.merge(cycle_number: 2)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with started_at" do
        params = valid_params.merge(started_at: started_at)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with cycle hash" do
        params = valid_params.merge(
          cycle: {
            id: "recy_123",
            recurrence_number: 2
          }
        )

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with metadata" do
        params = valid_params.merge(metadata: { "test" => "data" })

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with scheduled_timestamp" do
        params = valid_params.merge(scheduled_timestamp: scheduled_timestamp)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    let(:create_billing_cycle_operation) do
      instance_double(Finance::Operations::Subscriptions::CreateBillingCycle)
    end

    before do
      allow(Finance::Operations::Subscriptions::CreateBillingCycle).to receive(:new)
        .and_return(create_billing_cycle_operation)
    end

    context "when billing cycle exists with xendit_cycle_id" do
      let(:existing_billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: xendit_cycle_id,
          cycle_number: 5,
          status: "paid"
        )
      end

      before do
        existing_billing_cycle
      end

      it "returns existing billing cycle" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.id).to eq(existing_billing_cycle.id)
      end

      it "does not create a new billing cycle" do
        expect(create_billing_cycle_operation).not_to receive(:call)

        operation.call(valid_params)
      end

      it "does not update xendit_cycle_id when already present" do
        original_xendit_cycle_id = existing_billing_cycle.xendit_cycle_id

        result = operation.call(valid_params)

        expect(result).to be_success
        existing_billing_cycle.reload
        expect(existing_billing_cycle.xendit_cycle_id).to eq(original_xendit_cycle_id)
      end

      it "merges metadata when provided" do
        existing_billing_cycle.update!(metadata: { "existing" => "data" })

        result = operation.call(valid_params)

        expect(result).to be_success
        existing_billing_cycle.reload
        expect(existing_billing_cycle.metadata).to include("existing" => "data")
        expect(existing_billing_cycle.metadata).to include("key" => "value")
      end

      it "updates scheduled_timestamp when blank" do
        existing_billing_cycle.update!(scheduled_timestamp: nil)

        result = operation.call(valid_params)

        expect(result).to be_success
        existing_billing_cycle.reload
        expect(existing_billing_cycle.scheduled_timestamp).to eq(scheduled_timestamp)
      end

      it "does not update scheduled_timestamp when already present" do
        existing_billing_cycle.update!(scheduled_timestamp: scheduled_timestamp)
        original_scheduled_timestamp = existing_billing_cycle.scheduled_timestamp
        params = valid_params.merge(scheduled_timestamp: scheduled_timestamp + 1.day)

        result = operation.call(params)

        expect(result).to be_success
        existing_billing_cycle.reload
        expect(existing_billing_cycle.scheduled_timestamp).to eq(original_scheduled_timestamp)
      end

      it "does not update when no updates are needed" do
        existing_billing_cycle.update!(
          xendit_cycle_id: xendit_cycle_id,
          scheduled_timestamp: scheduled_timestamp,
          metadata: metadata
        )

        expect do
          operation.call(valid_params)
        end.not_to change { existing_billing_cycle.reload.updated_at }
      end
    end

    context "when billing cycle exists with cycle_number" do
      let(:different_xendit_cycle_id) { "recy_different_123" }
      let(:existing_billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: cycle_number,
          xendit_cycle_id: different_xendit_cycle_id,
          status: "pending"
        )
      end

      before do
        existing_billing_cycle
      end

      it "returns existing billing cycle" do
        params = valid_params.except(:xendit_cycle_id)

        result = operation.call(params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.id).to eq(existing_billing_cycle.id)
      end

      it "does not create a new billing cycle" do
        params = valid_params.except(:xendit_cycle_id)

        expect(create_billing_cycle_operation).not_to receive(:call)

        operation.call(params)
      end
    end

    context "when billing cycle does not exist" do
      it "creates a new billing cycle" do
        new_billing_cycle = build_stubbed(:finance_billing_cycle)
        allow(create_billing_cycle_operation).to receive(:call).and_return(
          Dry::Monads::Success(new_billing_cycle)
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(create_billing_cycle_operation).to have_received(:call) do |args|
          expect(args[:space_subscription_id]).to eq(space_subscription.id)
          expect(args[:cycle_number]).to eq(cycle_number)
          expect(args[:started_at]).to eq(started_at)
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          expect(args[:scheduled_timestamp]).to eq(scheduled_timestamp)
          expect(args[:metadata]).to eq(metadata)
        end
      end

      it "defaults metadata to empty hash when not provided" do
        params = valid_params.except(:metadata)
        new_billing_cycle = build_stubbed(:finance_billing_cycle)
        allow(create_billing_cycle_operation).to receive(:call).and_return(
          Dry::Monads::Success(new_billing_cycle)
        )

        operation.call(params)

        expect(create_billing_cycle_operation).to have_received(:call) do |args|
          expect(args[:metadata]).to eq({})
        end
      end

      it "passes cycle hash to CreateBillingCycle" do
        cycle_hash = { id: "recy_123", recurrence_number: 2 }
        params = valid_params.merge(cycle: cycle_hash)
        new_billing_cycle = build_stubbed(:finance_billing_cycle)
        allow(create_billing_cycle_operation).to receive(:call).and_return(
          Dry::Monads::Success(new_billing_cycle)
        )

        operation.call(params)

        expect(create_billing_cycle_operation).to have_received(:call) do |args|
          expect(args[:cycle]).to eq(cycle_hash)
        end
      end
    end

    context "when xendit_cycle_id takes precedence over cycle_number" do
      let(:different_xendit_cycle_id) { "recy_different_123" }
      let(:existing_by_xendit_id) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: xendit_cycle_id,
          cycle_number: 10,
          status: "paid"
        )
      end
      let(:existing_by_cycle_number) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: cycle_number,
          xendit_cycle_id: different_xendit_cycle_id,
          status: "pending"
        )
      end

      before do
        existing_by_xendit_id
        existing_by_cycle_number
      end

      it "finds by xendit_cycle_id first" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.id).to eq(existing_by_xendit_id.id)
      end
    end

    context "when update_existing_cycle fails" do
      let(:existing_billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: xendit_cycle_id,
          cycle_number: cycle_number,
          scheduled_timestamp: nil
        )
      end

      before do
        existing_billing_cycle
        # Reload to get the actual record from database
        existing_billing_cycle.reload
        allow(existing_billing_cycle).to receive(:update!).and_raise(
          ActiveRecord::RecordInvalid.new(existing_billing_cycle)
        )
        allow(space_subscription.billing_cycles).to receive(:find_by)
          .and_return(existing_billing_cycle)
      end

      it "returns failure with validation errors" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle)
      end
    end

    context "when create_new_cycle fails" do
      it "returns failure from CreateBillingCycle" do
        allow(create_billing_cycle_operation).to receive(:call).and_return(
          Dry::Monads::Failure(billing_cycle: ["validation error"])
        )

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle)
      end
    end
  end
end
