# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::Webhooks::HandleCycleSucceeded, type: :operation do
  let(:operation) { described_class.new }
  let(:space_subscription) do
    create(
      :space_subscription,
      xendit_plan_id: "repl_978b8060-6c03-4dc7-83ac-c6f83f965446",
      current_cycle_count: 0
    )
  end
  let(:xendit_cycle_id) { "recy_f53310f4-f522-4173-b92b-7254fca5e19a" }
  let(:scheduled_timestamp) { "2025-11-27T02:32:29.165Z" }
  let(:cycle_number) { 1 }
  let(:amount) { 399 }
  let(:currency) { "PHP" }

  let(:valid_params) do
    {
      plan_id: space_subscription.xendit_plan_id,
      id: xendit_cycle_id,
      cycle_number: cycle_number,
      scheduled_timestamp: scheduled_timestamp,
      reference_id: "sub-408ffa80-35ab-447a-aa59-4346167b8305"
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

    context "with missing scheduled_timestamp" do
      it "returns failure" do
        params = valid_params.except(:scheduled_timestamp)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:scheduled_timestamp)
      end
    end

    context "with missing reference_id" do
      it "returns failure" do
        params = valid_params.except(:reference_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:reference_id)
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
    let(:find_or_create_billing_cycle_operation) do
      instance_double(Finance::Operations::Subscriptions::FindOrCreateBillingCycle)
    end
    let(:find_or_create_payment_operation) do
      instance_double(Finance::Operations::Subscriptions::FindOrCreatePayment)
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
    let(:payment) do
      create(
        :finance_payment,
        space_subscription: space_subscription,
        billing_cycle: billing_cycle,
        xendit_cycle_id: xendit_cycle_id,
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

      allow(Finance::Operations::Subscriptions::FindOrCreatePayment).to receive(:new)
        .and_return(find_or_create_payment_operation)
      allow(find_or_create_payment_operation).to receive(:call)
        .and_return(Dry::Monads::Success(payment))

      allow(Finance::UpdateSubscriptionCycleCountJob).to receive(:perform_later)
    end

    context "with valid parameters" do
      it "returns success with billing_cycle_id and payment_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:billing_cycle_id]).to eq(billing_cycle.id)
        expect(response[:payment_id]).to eq(payment.id)
        expect(response[:message]).to eq("Cycle succeeded")
      end

      it "finds space subscription by plan_id" do
        expect(find_space_subscription_operation).to receive(:call)
          .with(xendit_plan_id: space_subscription.xendit_plan_id)

        operation.call(valid_params)
      end

      it "finds or creates billing cycle" do
        expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:space_subscription]).to eq(space_subscription)
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          expect(args[:cycle_number]).to eq(cycle_number)
          expect(args[:started_at]).to be_a(DateTime)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end

      it "finds or creates payment" do
        expect(find_or_create_payment_operation).to receive(:call) do |args|
          expect(args[:space_subscription]).to eq(space_subscription)
          expect(args[:billing_cycle]).to eq(billing_cycle)
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          Dry::Monads::Success(payment)
        end

        operation.call(valid_params)
      end

      it "marks billing cycle as paid" do
        operation.call(valid_params)

        billing_cycle.reload
        payment.reload
        expect(billing_cycle.status).to eq("paid")
        expect(payment.status).to eq("succeeded")
        expect(payment.paid_at).to be_present
        expect(billing_cycle.paid_at).to eq(payment.paid_at)
      end

      it "clears action_url when cycle succeeds" do
        billing_cycle.update!(action_url: "https://example.com/retry")

        operation.call(valid_params)

        billing_cycle.reload
        expect(billing_cycle.action_url).to be_nil
      end

      it "marks payment as succeeded" do
        operation.call(valid_params)

        payment.reload
        expect(payment.status).to eq("succeeded")
        expect(payment.paid_at).to be_present
      end

      context "when billing cycle span covers current time" do
        it "enqueues cycle count update job" do
          expect(Finance::UpdateSubscriptionCycleCountJob).to receive(:perform_later).with(
            space_subscription_id: space_subscription.id,
            cycle_number: cycle_number
          )

          operation.call(valid_params)
        end
      end

      context "when billing cycle span does not cover current time" do
        let(:billing_cycle) do
          create(
            :finance_billing_cycle,
            :future,
            space_subscription: space_subscription,
            xendit_cycle_id: xendit_cycle_id,
            cycle_number: cycle_number,
            status: "pending"
          )
        end

        it "does not enqueue cycle count update job" do
          expect(Finance::UpdateSubscriptionCycleCountJob).not_to receive(:perform_later)

          operation.call(valid_params)
        end
      end

      context "when cycle_number is not present" do
        let(:valid_params_without_cycle_number) do
          valid_params.except(:cycle_number)
        end

        it "does not enqueue cycle count update job" do
          allow(find_or_create_billing_cycle_operation).to receive(:call)
            .and_return(Dry::Monads::Success(billing_cycle))

          expect(Finance::UpdateSubscriptionCycleCountJob).not_to receive(:perform_later)

          operation.call(valid_params_without_cycle_number)
        end
      end

      context "when billing cycle span cover returns false" do
        let(:billing_cycle) do
          cycle = create(
            :finance_billing_cycle,
            space_subscription: space_subscription,
            xendit_cycle_id: xendit_cycle_id,
            cycle_number: cycle_number,
            status: "pending"
          )
          span_mock = Object.new
          def span_mock.cover?(_time)
            false
          end
          allow(cycle).to receive(:span).and_return(span_mock)
          cycle
        end

        it "does not enqueue cycle count update job" do
          expect(Finance::UpdateSubscriptionCycleCountJob).not_to receive(:perform_later)

          operation.call(valid_params)
        end
      end
    end

    context "when cycle_number is greater than 1" do
      let(:cycle_number) { 2 }
      let(:previous_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1,
          status: "paid"
        )
      end

      context "when previous cycle exists" do
        before do
          previous_cycle
        end

        it "finds previous cycle" do
          operation.call(valid_params)

          expect(space_subscription.billing_cycles.where(cycle_number: 1).first).to eq(previous_cycle)
        end

        it "calculates started_at from previous cycle span end" do
          expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
            expect(args[:started_at]).to be_a(DateTime)
            expect(args[:started_at]).to be_within(1.second).of((previous_cycle.span.end + 1.second).to_datetime)
            Dry::Monads::Success(billing_cycle)
          end

          operation.call(valid_params)
        end
      end

      context "when previous cycle is not found and retry_attempt is less than 10" do
        it "reruns the operation with incremented retry_attempt" do
          allow(operation).to receive(:sleep)
          new_operation = described_class.new
          allow(described_class).to receive(:new).and_return(new_operation)

          # Mock the new operation's call to succeed
          allow(new_operation).to receive(:call) do |params|
            expect(params[:retry_attempt]).to eq(1)
            Dry::Monads::Success({ message: "Cycle succeeded", billing_cycle_id: billing_cycle.id, payment_id: payment.id })
          end

          result = operation.call(valid_params)

          expect(result).to be_success
        end
      end

      context "when previous cycle is not found and retry_attempt is 10 or more" do
        let(:valid_params_with_retry) do
          valid_params.merge(retry_attempt: 10)
        end

        it "does not rerun the operation and continues normally" do
          allow(operation).to receive(:sleep)
          new_operation = described_class.new
          allow(described_class).to receive(:new).and_return(new_operation)

          expect(new_operation).not_to receive(:call)

          result = operation.call(valid_params_with_retry)

          expect(result).to be_success
        end
      end
    end

    context "when cycle_number is 1" do
      let(:cycle_number) { 1 }

      it "does not find previous cycle" do
        operation.call(valid_params)

        expect(space_subscription.billing_cycles.where(cycle_number: 0).first).to be_nil
      end

      it "calculates started_at from scheduled_timestamp" do
        expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:started_at]).to be_a(DateTime)
          expect(args[:started_at].to_s).to eq(DateTime.parse(scheduled_timestamp).to_s)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
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
        allow(find_or_create_billing_cycle_operation).to receive(:call)
          .and_return(Dry::Monads::Failure(billing_cycle: "creation failed"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:billing_cycle)
      end
    end

    context "when payment creation fails" do
      it "returns failure" do
        allow(find_or_create_payment_operation).to receive(:call)
          .and_return(Dry::Monads::Failure(payment: "creation failed"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:payment)
      end
    end

    context "when marking billing cycle as paid fails" do
      it "raises error and rolls back transaction" do
        allow(billing_cycle).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(billing_cycle))

        expect { operation.call(valid_params) }.to raise_error(ActiveRecord::RecordInvalid)
      end
    end

    context "when marking payment as succeeded fails" do
      it "raises error and rolls back transaction" do
        allow(payment).to receive(:mark_as_paid!).and_raise(ActiveRecord::RecordInvalid.new(payment))

        expect { operation.call(valid_params) }.to raise_error(ActiveRecord::RecordInvalid)
      end
    end
  end
end
