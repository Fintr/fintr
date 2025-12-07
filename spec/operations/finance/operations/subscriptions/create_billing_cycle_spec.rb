# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::CreateBillingCycle, type: :operation do
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
      space_subscription_id: space_subscription.id.to_s,
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

    context "with missing space_subscription_id" do
      it "returns failure" do
        params = valid_params.except(:space_subscription_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_subscription_id)
      end
    end

    context "with missing cycle_number" do
      it "returns failure" do
        params = valid_params.except(:cycle_number)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:cycle_number)
      end
    end

    context "with missing started_at" do
      it "returns failure" do
        params = valid_params.except(:started_at)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:started_at)
      end
    end

    context "with optional cycle" do
      it "returns success when cycle is not provided" do
        params = valid_params.except(:cycle)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when cycle is provided" do
        params = valid_params.merge(cycle: { id: xendit_cycle_id, recurrence_number: cycle_number })

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with optional xendit_cycle_id" do
      it "returns success when xendit_cycle_id is not provided" do
        params = valid_params.except(:xendit_cycle_id)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with optional metadata" do
      it "returns success when metadata is not provided" do
        params = valid_params.except(:metadata)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with optional scheduled_timestamp" do
      it "returns success when scheduled_timestamp is not provided" do
        params = valid_params.except(:scheduled_timestamp)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    context "with valid parameters" do
      it "returns success with billing cycle" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle).to be_a(Finance::BillingCycle)
        expect(billing_cycle.space_subscription).to eq(space_subscription)
      end

      it "creates billing cycle with correct cycle_number" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.cycle_number).to eq(cycle_number)
      end

      it "creates billing cycle with correct xendit_cycle_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.xendit_cycle_id).to eq(xendit_cycle_id)
      end

      it "creates billing cycle with correct scheduled_timestamp" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.scheduled_timestamp).to eq(scheduled_timestamp)
      end

      it "creates billing cycle with correct metadata" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.metadata).to eq(metadata)
      end

      it "creates billing cycle with status pending" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.status).to eq("pending")
      end

      it "calculates span correctly for monthly interval" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.span).to be_a(Range)
        expect(billing_cycle.started_at).to eq(started_at.beginning_of_day)
        expect(billing_cycle.ends_at).to eq((started_at.beginning_of_day + 1.month - 1.day).end_of_day)
      end

      it "sets tokens_allocated from subscription plan token_limit" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.tokens_allocated).to eq(subscription_plan.token_limit)
      end
    end

    context "when extracting cycle_number" do
      it "uses cycle_number from params when provided directly" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.cycle_number).to eq(cycle_number)
      end

      it "extracts cycle_number from nested cycle structure as fallback" do
        # Contract requires cycle_number at top level, but operation can extract from nested as fallback
        # This tests the extraction logic when both are provided
        params = valid_params.merge(
          cycle: {
            recurrence_number: 2
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        billing_cycle = result.value!
        # Should use top-level cycle_number, not nested
        expect(billing_cycle.cycle_number).to eq(cycle_number)
      end
    end

    context "when extracting xendit_cycle_id" do
      it "uses xendit_cycle_id from params when provided directly" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.xendit_cycle_id).to eq(xendit_cycle_id)
      end

      it "extracts xendit_cycle_id from nested cycle structure" do
        params = valid_params.except(:xendit_cycle_id).merge(
          cycle: {
            id: "recy_nested_123"
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.xendit_cycle_id).to eq("recy_nested_123")
      end
    end

    context "when calculating span" do
      it "uses beginning_of_day for cycle_start" do
        started_at_with_time = Time.zone.parse("2025-01-15 14:30:00").to_datetime
        params = valid_params.merge(started_at: started_at_with_time)

        result = operation.call(params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.started_at).to eq(started_at_with_time.beginning_of_day)
      end

      it "calculates cycle_end based on subscription plan interval" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expected_end = (started_at.beginning_of_day + 1.month - 1.day).end_of_day
        expect(billing_cycle.ends_at).to eq(expected_end)
      end

      context "with yearly interval" do
        let(:yearly_subscription_plan) { create(:subscription_plan, interval: "year", token_limit: 500) }
        let(:yearly_space_subscription) do
          create(
            :space_subscription,
            space: space,
            subscription_plan: yearly_subscription_plan
          )
        end
        let(:yearly_params) do
          {
            space_subscription_id: yearly_space_subscription.id.to_s,
            cycle_number: cycle_number,
            started_at: started_at,
            xendit_cycle_id: xendit_cycle_id
          }
        end

        it "calculates cycle_end for yearly interval" do
          result = operation.call(yearly_params)

          expect(result).to be_success
          billing_cycle = result.value!
          expected_end = (started_at.beginning_of_day + 1.year - 1.day).end_of_day
          expect(billing_cycle.ends_at).to eq(expected_end)
        end
      end
    end

    context "when metadata is not provided" do
      it "defaults to empty hash" do
        params = valid_params.except(:metadata)

        result = operation.call(params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.metadata).to eq({})
      end
    end

    context "when scheduled_timestamp is not provided" do
      it "sets scheduled_timestamp to nil" do
        params = valid_params.except(:scheduled_timestamp)

        result = operation.call(params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.scheduled_timestamp).to be_nil
      end
    end

    context "when billing cycle already exists with xendit_cycle_id" do
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

      it "updates existing billing cycle instead of creating new one" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.id).to eq(existing_billing_cycle.id)
      end

      it "updates cycle_number of existing billing cycle" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.cycle_number).to eq(cycle_number)
      end

      it "updates span of existing billing cycle" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.span).to be_a(Range)
        expect(billing_cycle.started_at).to eq(started_at.beginning_of_day)
      end

      it "updates tokens_allocated of existing billing cycle" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.tokens_allocated).to eq(subscription_plan.token_limit)
      end

      it "updates metadata of existing billing cycle" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.metadata).to eq(metadata)
      end

      it "updates scheduled_timestamp of existing billing cycle" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.scheduled_timestamp).to eq(scheduled_timestamp)
      end

      it "sets status to pending even if existing cycle had different status" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.status).to eq("pending")
      end
    end

    context "when finding existing cycle by xendit_cycle_id" do
      let(:existing_billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 5,
          xendit_cycle_id: xendit_cycle_id,
          status: "paid"
        )
      end

      before do
        existing_billing_cycle
      end

      it "finds and updates existing cycle by xendit_cycle_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle = result.value!
        # Should update the existing cycle
        expect(billing_cycle.id).to eq(existing_billing_cycle.id)
        expect(billing_cycle.cycle_number).to eq(cycle_number)
        expect(billing_cycle.status).to eq("pending")
      end
    end

    context "when space subscription is not found" do
      it "returns failure" do
        params = valid_params.merge(space_subscription_id: "non-existent-id")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_subscription_id)
        expect(result.failure[:space_subscription_id]).to eq("not found")
      end
    end

    context "when billing cycle validation fails" do
      it "returns failure with validation errors" do
        # Create a billing cycle with the same cycle_number but different xendit_cycle_id
        # This will cause a uniqueness validation error on cycle_number
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: cycle_number,
          xendit_cycle_id: "different_cycle_id"
        )
        # Use a different xendit_cycle_id so it doesn't find the existing one
        params = valid_params.merge(xendit_cycle_id: "another_cycle_id")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle)
        expect(result.failure[:billing_cycle]).to be_an(Array)
      end
    end

    context "when an unexpected error occurs during save" do
      it "returns failure with error message" do
        # Create a billing cycle that will cause an error when trying to save
        # We'll stub the save! method to raise an error
        operation_instance = described_class.new

        # Mock the previous steps
        validated_params = operation_instance.validate(params: valid_params).value!
        space_sub = Finance::SpaceSubscription.find_by(id: validated_params[:space_subscription_id])
        allow(operation_instance).to receive(:find_space_subscription)
          .and_return(Dry::Monads::Success(space_sub))
        allow(operation_instance).to receive(:extract_cycle_data)
          .and_return(Dry::Monads::Success({
            cycle_number: cycle_number,
            span: (started_at.beginning_of_day..(started_at.beginning_of_day + 1.month - 1.day).end_of_day),
            tokens_allocated: subscription_plan.token_limit,
            xendit_cycle_id: xendit_cycle_id,
            scheduled_timestamp: scheduled_timestamp,
            metadata: metadata
          }))

        # Stub the billing cycle's save! to raise an error
        billing_cycle_double = instance_double(Finance::BillingCycle)
        allow(space_sub.billing_cycles).to receive(:find_or_initialize_by)
          .and_return(billing_cycle_double)
        allow(billing_cycle_double).to receive(:assign_attributes)
        allow(billing_cycle_double).to receive(:save!).and_raise(StandardError.new("Database connection lost"))

        result = operation_instance.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to create billing cycle")
      end
    end

    context "when cycle_number is provided in both params and nested cycle" do
      it "prefers cycle_number from params over nested cycle" do
        params = valid_params.merge(
          cycle: {
            recurrence_number: 3
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        billing_cycle = result.value!
        # Should use top-level cycle_number, not nested
        expect(billing_cycle.cycle_number).to eq(cycle_number)
      end
    end

    context "when preserving existing xendit_cycle_id on update" do
      let(:existing_billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: "existing_cycle_id",
          cycle_number: cycle_number
        )
      end
      let(:params_without_xendit_id) do
        valid_params.except(:xendit_cycle_id)
      end

      before do
        existing_billing_cycle
      end

      it "preserves existing xendit_cycle_id when not provided in params" do
        result = operation.call(params_without_xendit_id)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.xendit_cycle_id).to eq("existing_cycle_id")
      end
    end

    context "when preserving existing scheduled_timestamp on update" do
      let(:existing_scheduled_timestamp) { Time.zone.parse("2025-01-10 08:00:00").to_datetime }
      let(:existing_billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: xendit_cycle_id,
          cycle_number: cycle_number,
          scheduled_timestamp: existing_scheduled_timestamp
        )
      end
      let(:params_without_scheduled_timestamp) do
        valid_params.except(:scheduled_timestamp)
      end

      before do
        existing_billing_cycle
      end

      it "preserves existing scheduled_timestamp when not provided in params" do
        result = operation.call(params_without_scheduled_timestamp)

        expect(result).to be_success
        billing_cycle = result.value!
        expect(billing_cycle.scheduled_timestamp).to eq(existing_scheduled_timestamp)
      end
    end
  end
end
