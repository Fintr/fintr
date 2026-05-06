# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::Webhooks::HandleCycleCreated, type: :operation do
  let(:operation) { described_class.new }
  let(:space_subscription) do
    create(
      :space_subscription,
      xendit_plan_id: "repl_87d12b89-0cfc-4567-b52e-0698674a3f5d",
      metadata: { existing_key: "existing_value" }
    )
  end

  let(:xendit_cycle_id) { "recy_8594c21f-dda6-4482-8d66-966e1095c7e1" }
  let(:cycle_number) { 2 }
  let(:scheduled_timestamp) { "2025-12-26T04:49:51.000Z" }

  let(:valid_params) do
    {
      plan_id: space_subscription.xendit_plan_id,
      id: xendit_cycle_id,
      cycle_number: cycle_number,
      scheduled_timestamp: scheduled_timestamp,
      status: "SCHEDULED",
      reference_id: "sub-0886a8fa-6ca5-42ad-8b92-6f5d66d8ec76",
      customer_id: "cust-68238678-c654-45f1-a224-217bbd308ec1",
      type: "SCHEDULED",
      recurring_action: "PAYMENT",
      attempt_count: 0,
      currency: "PHP",
      amount: 250
    }
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with missing plan_id" do
      it "returns failure" do
        params = valid_params.except(:plan_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:plan_id)
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

    context "with missing cycle_number" do
      it "returns failure" do
        params = valid_params.except(:cycle_number)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:cycle_number)
      end
    end

    context "with nested cycle structure" do
      it "returns success when cycle_number is at top level and cycle has additional data" do
        params = valid_params.merge(
          cycle: {
            id: xendit_cycle_id,
            recurrence_number: cycle_number
          }
        )

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with nested plan structure" do
      it "returns success when plan_id is in nested plan" do
        params = valid_params.merge(
          plan: {
            id: space_subscription.xendit_plan_id
          }
        )

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with retry_attempt" do
      it "defaults retry_attempt to 0 when not provided" do
        params = valid_params.except(:retry_attempt)

        result = operation.validate(params: params)

        expect(result).to be_success
        expect(result.value![:retry_attempt]).to eq(0)
      end

      it "preserves retry_attempt when provided" do
        params = valid_params.merge(retry_attempt: 5)

        result = operation.validate(params: params)

        expect(result).to be_success
        expect(result.value![:retry_attempt]).to eq(5)
      end
    end
  end

  describe "#call" do
    let(:find_space_subscription_operation) do
      instance_double(Finance::Operations::Subscriptions::FindSpaceSubscriptionByXenditId)
    end
    let(:create_billing_cycle_operation) do
      instance_double(Finance::Operations::Subscriptions::CreateBillingCycle)
    end
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        xendit_cycle_id: xendit_cycle_id,
        cycle_number: cycle_number
      )
    end

    before do
      allow(Finance::Operations::Subscriptions::FindSpaceSubscriptionByXenditId).to receive(:new)
        .and_return(find_space_subscription_operation)
      allow(find_space_subscription_operation).to receive(:call)
        .and_return(Dry::Monads::Success(space_subscription))

      allow(Finance::Operations::Subscriptions::CreateBillingCycle).to receive(:new)
        .and_return(create_billing_cycle_operation)
      allow(create_billing_cycle_operation).to receive(:call)
        .and_return(Dry::Monads::Success(billing_cycle))
    end

    context "with valid parameters" do
      it "returns success with billing_cycle_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:billing_cycle_id]).to eq(billing_cycle.id)
        expect(response[:message]).to eq("Cycle created")
      end

      it "finds space subscription by plan_id" do
        expect(find_space_subscription_operation).to receive(:call)
          .with(xendit_plan_id: space_subscription.xendit_plan_id)

        operation.call(valid_params)
      end

      it "creates billing cycle with correct parameters" do
        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:space_subscription_id]).to eq(space_subscription.id)
          expect(args[:cycle_number]).to eq(cycle_number)
          expect(args[:started_at]).to be_a(DateTime)
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          expect(args[:cycle]).to be_a(Hash)
          expect(args[:cycle][:plan_id]).to eq(valid_params[:plan_id])
          expect(args[:cycle][:cycle_number]).to eq(cycle_number)
          expect(args[:cycle][:id]).to eq(xendit_cycle_id)
          expect(args[:metadata]).to be_a(Hash)
          expect(args[:metadata]["plan_id"]).to eq(valid_params[:plan_id])
          expect(args[:metadata]["cycle_number"]).to eq(cycle_number)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end

      it "passes cycle data as metadata to CreateBillingCycle" do
        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:metadata]).to be_a(Hash)
          expect(args[:metadata]["plan_id"]).to eq(valid_params[:plan_id])
          expect(args[:metadata]["cycle_number"]).to eq(cycle_number)
          expect(args[:metadata]["id"]).to eq(xendit_cycle_id)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end
    end

    context "when cycle_number is in nested cycle structure" do
      let(:params_with_nested_cycle) do
        # Note: cycle_number is still required at top level for validation
        # but operation can extract from nested structure as fallback
        valid_params.merge(
          cycle: {
            id: xendit_cycle_id,
            recurrence_number: cycle_number
          }
        )
      end

      it "uses cycle_number from top level" do
        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:cycle_number]).to eq(cycle_number)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(params_with_nested_cycle)
      end
    end

    context "when cycle ID is in nested cycle structure" do
      let(:params_with_nested_cycle_id) do
        # Note: id is still required at top level for validation
        # but operation can extract from nested structure as fallback
        valid_params.merge(
          cycle: {
            id: xendit_cycle_id,
            recurrence_number: cycle_number
          }
        )
      end

      it "uses cycle ID from top level" do
        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(params_with_nested_cycle_id)
      end
    end

    context "when cycle_id is provided as separate field" do
      let(:params_with_cycle_id) do
        # Note: id is still required at top level for validation
        # but operation can extract from cycle_id field as fallback
        valid_params.merge(cycle_id: xendit_cycle_id)
      end

      it "uses cycle ID from top level id field" do
        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(params_with_cycle_id)
      end
    end

    context "when scheduled_timestamp is provided" do
      it "parses scheduled_timestamp to DateTime" do
        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at]).to be_a(DateTime)
          # DateTime.parse converts "2025-12-26T04:49:51.000Z" to equivalent DateTime
          expect(args[:started_at].to_s).to eq(DateTime.parse(scheduled_timestamp).to_s)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end
    end

    context "when cycle_number is 1" do
      let(:first_cycle_params) do
        valid_params.merge(cycle_number: 1)
      end

      it "does not look for previous cycle" do
        expect(space_subscription.billing_cycles).not_to receive(:reload)

        operation.call(first_cycle_params)
      end

      it "uses scheduled_timestamp for started_at when provided" do
        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at].to_s).to eq(DateTime.parse(scheduled_timestamp).to_s)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(first_cycle_params)
      end

      it "uses current time for started_at when scheduled_timestamp is not provided" do
        params_without_timestamp = first_cycle_params.except(:scheduled_timestamp)
        freeze_time = Time.zone.now

        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at].to_s).to eq(freeze_time.to_datetime.to_s)
          Dry::Monads::Success(billing_cycle)
        end

        travel_to(freeze_time) do
          operation.call(params_without_timestamp)
        end
      end
    end

    context "when cycle_number is greater than 1" do
      let(:previous_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: cycle_number - 1,
          span: (1.month.ago.beginning_of_month..1.month.ago.end_of_month.end_of_day)
        )
      end

      before do
        previous_cycle
      end

      it "finds previous cycle" do
        expect(space_subscription.billing_cycles).to receive(:reload).and_call_original

        operation.call(valid_params)
      end

      it "calculates started_at from previous cycle span end plus 1 second" do
        expected_started_at = (previous_cycle.span.end + 1.second).to_datetime

        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at].to_s).to eq(expected_started_at.to_s)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end

      it "ignores scheduled_timestamp when previous cycle exists" do
        expected_started_at = (previous_cycle.span.end + 1.second).to_datetime

        expect(create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at].to_s).to eq(expected_started_at.to_s)
          expect(args[:started_at].to_s).not_to eq(DateTime.parse(scheduled_timestamp).to_s)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end
    end

    context "when cycle_number is greater than 1 and previous cycle is not found" do
      let(:retry_billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: xendit_cycle_id,
          cycle_number: 3
        )
      end
      let(:params_without_previous_cycle) do
        {
          plan_id: space_subscription.xendit_plan_id,
          id: xendit_cycle_id,
          cycle_number: 3,
          scheduled_timestamp: scheduled_timestamp,
          retry_attempt: 0
        }
      end

      before do
        # Ensure no previous cycle exists (cycle_number 2)
        space_subscription.billing_cycles.where(cycle_number: 2).delete_all
      end

      context "when retry_attempt is less than 10" do
        it "reruns the operation when previous cycle is not found" do
          retry_operation = instance_double(described_class)
          call_args = nil
          allow(described_class).to receive(:new).and_return(retry_operation)
          allow(retry_operation).to receive(:call) do |args|
            call_args = args
            Dry::Monads::Success({ message: "Cycle created", billing_cycle_id: retry_billing_cycle.id })
          end

          allow(Kernel).to receive(:sleep)

          result = operation.call(params_without_previous_cycle)

          expect(result).to be_success
          # Verify the retry operation was called
          expect(described_class).to have_received(:new)
          expect(retry_operation).to have_received(:call)
          # Verify the retry was called with the correct cycle_number
          expect(call_args[:cycle_number]).to eq(3)
        end
      end

      context "when retry_attempt is 10 or greater" do
        let(:params_with_max_retry) do
          {
            plan_id: space_subscription.xendit_plan_id,
            id: xendit_cycle_id,
            cycle_number: 3,
            scheduled_timestamp: scheduled_timestamp,
            retry_attempt: 10
          }
        end

        it "does not retry and proceeds with creation" do
          allow(Kernel).to receive(:sleep)
          allow(create_billing_cycle_operation).to receive(:call).and_return(Dry::Monads::Success(retry_billing_cycle))

          result = operation.call(params_with_max_retry)

          expect(result).to be_success
          expect(Kernel).not_to have_received(:sleep)
        end
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

    context "when billing cycle creation fails" do
      it "returns failure" do
        allow(create_billing_cycle_operation).to receive(:call)
          .and_return(Dry::Monads::Failure(billing_cycle: "creation failed"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle)
      end
    end
  end
end
