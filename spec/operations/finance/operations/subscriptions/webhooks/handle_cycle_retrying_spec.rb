# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::Webhooks::HandleCycleRetrying, type: :operation do
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
  let(:attempt_details) do
    [
      {
        "payment_link" => {
          "payment_link_url" => "https://checkout.xendit.co/web/abc123"
        }
      }
    ]
  end

  let(:valid_params) do
    {
      plan_id: space_subscription.xendit_plan_id,
      id: xendit_cycle_id,
      cycle_number: cycle_number,
      scheduled_timestamp: scheduled_timestamp,
      attempt_details: attempt_details
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

    context "with optional cycle_number" do
      it "returns success when cycle_number is not provided" do
        params = valid_params.except(:cycle_number)

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

    context "with optional attempt_details" do
      it "returns success when attempt_details is not provided" do
        params = valid_params.except(:attempt_details)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with optional retry_attempt" do
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
    let(:find_or_create_billing_cycle_operation) do
      instance_double(Finance::Operations::Subscriptions::FindOrCreateBillingCycle)
    end
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        xendit_cycle_id: xendit_cycle_id,
        cycle_number: cycle_number,
        status: "pending"
      )
    end

    before do
      allow(Finance::Operations::Subscriptions::FindSpaceSubscriptionByXenditId).to receive(:new)
        .and_return(find_space_subscription_operation)
      allow(find_space_subscription_operation).to receive(:call)
        .and_return(Dry::Monads::Success(space_subscription))

      allow(Finance::Operations::Subscriptions::FindOrCreateBillingCycle).to receive(:new)
        .and_return(find_or_create_billing_cycle_operation)
      allow(find_or_create_billing_cycle_operation).to receive(:call)
        .and_return(Dry::Monads::Success(billing_cycle))
    end

    context "with valid parameters" do
      it "returns success with billing_cycle_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:billing_cycle_id]).to eq(billing_cycle.id)
        expect(response[:message]).to eq("Cycle retrying")
      end

      it "finds space subscription by plan_id" do
        expect(find_space_subscription_operation).to receive(:call)
          .with(xendit_plan_id: space_subscription.xendit_plan_id)

        operation.call(valid_params)
      end

      it "finds or creates billing cycle with correct parameters" do
        expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:space_subscription]).to eq(space_subscription)
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          expect(args[:cycle_number]).to eq(cycle_number)
          expect(args[:started_at]).to be_a(DateTime)
          expect(args[:scheduled_timestamp]).to be_a(DateTime)
          expect(args[:metadata]).to eq({})
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end

      it "updates billing cycle metadata with retry attempt details" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle.reload
        expect(billing_cycle.metadata["retry_attempts"]).to be_an(Array)
        expect(billing_cycle.metadata["retry_attempts"].last).to include(
          "plan_id" => space_subscription.xendit_plan_id,
          "id" => xendit_cycle_id,
          "cycle_number" => cycle_number
        )
      end

      it "marks billing cycle as failed" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle.reload
        expect(billing_cycle.status).to eq("failed")
      end

      it "sets action_url from attempt_details" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle.reload
        expect(billing_cycle.action_url).to eq("https://checkout.xendit.co/web/abc123")
      end
    end

    context "when cycle_number is 1" do
      let(:cycle_number) { 1 }

      it "does not find previous cycle" do
        expect(space_subscription.billing_cycles).not_to receive(:reload)

        operation.call(valid_params)
      end

      it "uses scheduled_timestamp or current time for started_at" do
        expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at]).to be_a(DateTime)
          expect(args[:started_at].to_s).to eq(DateTime.parse(scheduled_timestamp).to_s)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end
    end

    context "when cycle_number is greater than 1 and previous cycle exists" do
      let(:previous_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: cycle_number - 1,
          span: (1.month.ago.beginning_of_month..1.month.ago.end_of_month)
        )
      end

      before do
        previous_cycle
      end

      it "finds previous cycle" do
        expect(space_subscription.billing_cycles).to receive(:reload).and_call_original

        operation.call(valid_params)
      end

      it "calculates started_at from previous cycle end" do
        expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
          expected_started_at = (previous_cycle.span.end + 1.second).to_datetime
          expect(args[:started_at].to_s).to eq(expected_started_at.to_s)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end
    end

    context "when cycle_number is greater than 1 and previous cycle does not exist" do
      let(:cycle_number) { 3 }
      let(:retry_attempt) { 0 }

      before do
        allow(operation).to receive(:sleep)
      end

      it "reruns operation when retry_attempt is less than 10" do
        params = valid_params.merge(retry_attempt: retry_attempt)
        rerun_result = Dry::Monads::Success({ message: "Cycle retrying", billing_cycle_id: billing_cycle.id })

        allow(described_class).to receive(:new).and_return(operation)
        allow(operation).to receive(:call).and_call_original
        allow(operation).to receive(:call).with(
          hash_including(
            plan_id: space_subscription.xendit_plan_id,
            id: xendit_cycle_id,
            cycle_number: cycle_number,
            retry_attempt: retry_attempt + 1
          )
        ).and_return(rerun_result)

        result = operation.call(params)

        expect(result).to be_success
        expect(operation).to have_received(:call).with(
          hash_including(retry_attempt: retry_attempt + 1)
        )
      end

      it "does not rerun operation when retry_attempt is 10 or more" do
        params = valid_params.merge(retry_attempt: 10)

        expect(operation).not_to receive(:rerun_operation)

        operation.call(params)
      end
    end

    context "when cycle_number is not provided" do
      let(:valid_params_without_cycle_number) do
        valid_params.except(:cycle_number)
      end

      it "does not find previous cycle" do
        expect(space_subscription.billing_cycles).not_to receive(:reload)

        operation.call(valid_params_without_cycle_number)
      end

      it "uses scheduled_timestamp or current time for started_at" do
        expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at]).to be_a(DateTime)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params_without_cycle_number)
      end
    end

    context "when scheduled_timestamp is not provided" do
      let(:valid_params_without_timestamp) do
        valid_params.except(:scheduled_timestamp)
      end

      it "uses current time for started_at when previous cycle is blank" do
        expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at]).to be_a(DateTime)
          expect(args[:started_at]).to be_within(1.second).of(Time.zone.now.to_datetime)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params_without_timestamp)
      end
    end

    context "when attempt_details does not contain payment_link_url" do
      let(:attempt_details_without_url) do
        [
          {
            "type" => "PAYMENT_LINK",
            "status" => "failed"
          }
        ]
      end
      let(:params_without_url) do
        valid_params.merge(attempt_details: attempt_details_without_url)
      end

      it "does not set action_url" do
        result = operation.call(params_without_url)

        expect(result).to be_success
        billing_cycle.reload
        expect(billing_cycle.action_url).to be_nil
      end
    end

    context "when attempt_details is not provided" do
      let(:params_without_attempt_details) do
        valid_params.except(:attempt_details)
      end

      it "does not set action_url" do
        result = operation.call(params_without_attempt_details)

        expect(result).to be_success
        billing_cycle.reload
        expect(billing_cycle.action_url).to be_nil
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

    context "when billing cycle find or create fails" do
      it "returns failure" do
        allow(find_or_create_billing_cycle_operation).to receive(:call)
          .and_return(Dry::Monads::Failure(billing_cycle: "creation failed"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle)
      end
    end

    context "when updating billing cycle metadata fails" do
      it "returns failure" do
        allow(billing_cycle).to receive(:update!).and_raise(
          ActiveRecord::RecordInvalid.new(billing_cycle)
        )
        allow(billing_cycle).to receive(:reload).and_return(billing_cycle)

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle)
      end
    end

    context "when attempt_details contains payment_link_url with symbol keys" do
      let(:attempt_details_with_symbols) do
        [
          {
            payment_link: {
              payment_link_url: "https://checkout.xendit.co/web/xyz789"
            }
          }
        ]
      end
      let(:params_with_symbols) do
        valid_params.merge(attempt_details: attempt_details_with_symbols)
      end

      it "extracts action_url from symbol keys" do
        result = operation.call(params_with_symbols)

        expect(result).to be_success
        billing_cycle.reload
        expect(billing_cycle.action_url).to eq("https://checkout.xendit.co/web/xyz789")
      end
    end

    context "when metadata already contains retry_attempts" do
      before do
        billing_cycle.update!(
          metadata: {
            "retry_attempts" => [
              { "id" => "previous_cycle", "cycle_number" => 1 }
            ]
          }
        )
        allow(find_or_create_billing_cycle_operation).to receive(:call)
          .and_return(Dry::Monads::Success(billing_cycle))
      end

      it "appends new retry attempt to existing array" do
        result = operation.call(valid_params)

        expect(result).to be_success
        billing_cycle.reload
        retry_attempts = billing_cycle.metadata["retry_attempts"]
        expect(retry_attempts.length).to eq(2)
        expect(retry_attempts.last).to include(
          "plan_id" => space_subscription.xendit_plan_id,
          "id" => xendit_cycle_id
        )
      end
    end
  end
end
