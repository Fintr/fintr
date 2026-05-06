# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::Webhooks::HandleCycleFailed, type: :operation do
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
  let(:failure_reason) { "Insufficient funds" }
  let(:action_url) { "https://example.com/retry" }

  let(:valid_params) do
    {
      plan_id: space_subscription.xendit_plan_id,
      id: xendit_cycle_id,
      cycle_number: cycle_number,
      reference_id: "sub-0886a8fa-6ca5-42ad-8b92-6f5d66d8ec76",
      scheduled_timestamp: scheduled_timestamp,
      failure_reason: failure_reason,
      actions: [
        {
          url: action_url
        }
      ],
      status: "FAILED",
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

      it "sets retry_attempt to 0 if not provided" do
        params = valid_params.except(:retry_attempt)

        result = operation.validate(params: params)

        expect(result).to be_success
        expect(result.value![:retry_attempt]).to eq(0)
      end

      it "preserves retry_attempt if provided" do
        params = valid_params.merge(retry_attempt: 5)

        result = operation.validate(params: params)

        expect(result).to be_success
        expect(result.value![:retry_attempt]).to eq(5)
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

    context "with missing reference_id" do
      it "returns failure" do
        params = valid_params.except(:reference_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:reference_id)
      end
    end

    context "with missing actions" do
      it "returns failure" do
        params = valid_params.except(:actions)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:actions)
      end
    end

    context "with actions missing url" do
      it "returns failure" do
        params = valid_params.merge(actions: [{ invalid_key: "value" }])

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:actions)
      end
    end

    context "with optional parameters" do
      it "allows scheduled_timestamp to be nil" do
        params = valid_params.merge(scheduled_timestamp: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "allows failure_reason to be nil" do
        params = valid_params.merge(failure_reason: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "allows action_url to be nil" do
        params = valid_params.merge(action_url: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "allows retry_attempt to be nil" do
        params = valid_params.merge(retry_attempt: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
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
    let(:previous_cycle) do
      # Only create previous cycle if cycle_number > 1
      if cycle_number > 1
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: cycle_number - 1,
          status: "paid"
        )
      end
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
    end

    context "with valid parameters" do
      before do
        previous_cycle
      end

      it "returns success with subscription_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:subscription_id]).to eq(space_subscription.id)
        expect(response[:message]).to eq("Cycle failed")
      end

      it "finds space subscription by plan_id" do
        expect(find_space_subscription_operation).to receive(:call)
          .with(xendit_plan_id: space_subscription.xendit_plan_id)

        operation.call(valid_params)
      end

      it "finds previous cycle when cycle_number is greater than 1" do
        operation.call(valid_params)

        expect(space_subscription.billing_cycles.reload.where(cycle_number: cycle_number - 1).first)
          .to eq(previous_cycle)
      end

      it "finds or creates billing cycle with correct parameters" do
        expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
          expect(args[:space_subscription]).to eq(space_subscription)
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          expect(args[:cycle_number]).to eq(cycle_number)
          expect(args[:started_at]).to be_a(DateTime)
          expect(args[:scheduled_timestamp]).to be_a(DateTime)
          expect(args[:metadata]).to be_a(Hash)
          expect(args[:metadata]["plan_id"]).to eq(valid_params[:plan_id])
          expect(args[:metadata]["cycle_number"]).to eq(cycle_number)
          Dry::Monads::Success(billing_cycle)
        end

        operation.call(valid_params)
      end

      it "finds or creates payment when xendit_cycle_id and billing_cycle are present" do
        expect(find_or_create_payment_operation).to receive(:call) do |args|
          expect(args[:space_subscription]).to eq(space_subscription)
          expect(args[:billing_cycle]).to eq(billing_cycle)
          expect(args[:xendit_cycle_id]).to eq(xendit_cycle_id)
          Dry::Monads::Success(payment)
        end

        operation.call(valid_params)
      end

      it "marks payment as failed" do
        operation.call(valid_params)

        payment.reload
        expect(payment.status).to eq("failed")
        expect(payment.failed_at).to be_present
        expect(payment.failure_reason).to eq(failure_reason)
        # xendit_data contains the validated params (only Contract fields)
        expect(payment.xendit_data).to include(
          "plan_id" => valid_params[:plan_id],
          "id" => valid_params[:id],
          "cycle_number" => valid_params[:cycle_number],
          "reference_id" => valid_params[:reference_id],
          "failure_reason" => valid_params[:failure_reason],
          "retry_attempt" => 0
        )
        expect(payment.metadata["cycle_data"]).to include(
          "plan_id" => valid_params[:plan_id],
          "id" => valid_params[:id],
          "cycle_number" => valid_params[:cycle_number]
        )
      end

      it "marks billing cycle as failed" do
        operation.call(valid_params)

        billing_cycle.reload
        expect(billing_cycle.status).to eq("failed")
        expect(billing_cycle.action_url).to eq(action_url)
      end

      it "sets action_url from actions array" do
        operation.call(valid_params)

        billing_cycle.reload
        expect(billing_cycle.action_url).to eq(action_url)
      end

      it "does not set action_url when actions array is empty" do
        params = valid_params.merge(actions: [])

        operation.call(params)

        billing_cycle.reload
        expect(billing_cycle.action_url).to be_nil
      end

      context "when scheduled_timestamp is provided but previous_cycle exists" do
        it "uses previous cycle span end for started_at calculation" do
          expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
            expect(args[:started_at]).to be_a(DateTime)
            expect(args[:started_at]).to be_within(1.second).of((previous_cycle.span.end + 1.second).to_datetime)
            Dry::Monads::Success(billing_cycle)
          end

          operation.call(valid_params)
        end
      end

      context "when scheduled_timestamp is provided and previous_cycle is blank" do
        before do
          allow(space_subscription.billing_cycles).to receive(:reload).and_return(space_subscription.billing_cycles)
          relation_double = instance_double(ActiveRecord::Relation, first: nil)
          allow(space_subscription.billing_cycles).to receive(:where).and_return(relation_double)
        end

        it "parses scheduled_timestamp to DateTime for started_at calculation" do
          expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
            expect(args[:started_at]).to be_a(DateTime)
            expect(args[:started_at].to_s).to eq(DateTime.parse(scheduled_timestamp).to_s)
            Dry::Monads::Success(billing_cycle)
          end

          operation.call(valid_params)
        end
      end

      context "when scheduled_timestamp is not provided" do
        let(:params_without_timestamp) do
          valid_params.except(:scheduled_timestamp)
        end

        it "uses current time for started_at when previous_cycle is blank" do
          relation_double = instance_double(ActiveRecord::Relation, first: nil)
          allow(space_subscription.billing_cycles).to receive(:where).and_return(relation_double)

          expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
            expect(args[:started_at]).to be_a(DateTime)
            expect(args[:started_at]).to be_within(1.second).of(Time.zone.now.to_datetime)
            Dry::Monads::Success(billing_cycle)
          end

          operation.call(params_without_timestamp)
        end
      end

      context "when previous_cycle exists" do
        it "calculates started_at from previous cycle span end" do
          expect(find_or_create_billing_cycle_operation).to receive(:call) do |args|
            expect(args[:started_at]).to be_a(DateTime)
            expect(args[:started_at]).to be_within(1.second).of((previous_cycle.span.end + 1.second).to_datetime)
            Dry::Monads::Success(billing_cycle)
          end

          operation.call(valid_params)
        end
      end

      context "when cycle_number is 1" do
        let(:cycle_number) { 1 }
        let(:billing_cycle) do
          create(
            :finance_billing_cycle,
            space_subscription: space_subscription,
            xendit_cycle_id: xendit_cycle_id,
            cycle_number: 1,
            status: "pending"
          )
        end

        before do
          # Don't create previous_cycle for cycle_number 1
          allow(space_subscription.billing_cycles).to receive(:reload).and_return(space_subscription.billing_cycles)
        end

        it "does not find previous cycle" do
          expect(space_subscription.billing_cycles).not_to receive(:where).with(cycle_number: 0)

          operation.call(valid_params)
        end
      end
    end

    context "when cycle_number is greater than 1 and previous_cycle is blank" do
      let(:cycle_number) { 2 }
      let(:previous_cycle_for_retry) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1,
          status: "paid"
        )
      end

      before do
        allow(space_subscription.billing_cycles).to receive(:reload).and_return(space_subscription.billing_cycles)
        relation_double = instance_double(ActiveRecord::Relation, first: nil)
        allow(space_subscription.billing_cycles).to receive(:where).and_return(relation_double)
      end

      context "when retry_attempt is less than 10" do
        let(:params_with_retry) { valid_params.merge(retry_attempt: 5) }

        it "reruns the operation when previous cycle is not found" do
          # Verify that rerun_operation is called when conditions are met
          # The rerun_operation method increments retry_attempt: (params[:retry_attempt] || 0) + 1
          retry_operation = instance_spy(described_class)
          allow(described_class).to receive(:new).and_return(retry_operation)

          # Mock successful retry call
          allow(retry_operation).to receive(:call).and_return(
            Dry::Monads::Success({ message: "Cycle failed", subscription_id: space_subscription.id })
          )

          result = operation.call(params_with_retry)

          # Verify that rerun was called (which means the increment logic executed)
          expect(retry_operation).to have_received(:call)
          expect(result).to be_success
        end
      end

      context "when retry_attempt is 10 or more" do
        let(:params_with_max_retry) { valid_params.merge(retry_attempt: 10) }

        it "does not rerun the operation" do
          # Should proceed with normal flow instead of rerunning
          expect(find_or_create_billing_cycle_operation).to receive(:call)

          operation.call(params_with_max_retry)
        end
      end
    end

    context "when xendit_cycle_id is blank" do
      let(:params_without_cycle_id) { valid_params.merge(id: "") }

      it "does not find or create payment" do
        expect(find_or_create_payment_operation).not_to receive(:call)

        operation.call(params_without_cycle_id)
      end

      it "still marks billing cycle as failed" do
        operation.call(params_without_cycle_id)

        billing_cycle.reload
        expect(billing_cycle.status).to eq("failed")
      end
    end

    context "when billing_cycle is blank" do
      before do
        allow(find_or_create_billing_cycle_operation).to receive(:call)
          .and_return(Dry::Monads::Success(nil))
      end

      it "does not find or create payment" do
        expect(find_or_create_payment_operation).not_to receive(:call)

        operation.call(valid_params)
      end

      it "does not mark billing cycle as failed" do
        expect(billing_cycle).not_to receive(:update!)

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

    context "when marking payment as failed fails" do
      it "raises error and rolls back transaction" do
        allow(payment).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(payment))

        expect { operation.call(valid_params) }.to raise_error(ActiveRecord::RecordInvalid)
      end
    end

    context "when marking billing cycle as failed fails" do
      it "raises error and rolls back transaction" do
        allow(billing_cycle).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(billing_cycle))

        expect { operation.call(valid_params) }.to raise_error(ActiveRecord::RecordInvalid)
      end
    end

    context "when failure_reason is not provided" do
      let(:params_without_reason) { valid_params.except(:failure_reason) }

      it "uses default failure reason" do
        operation.call(params_without_reason)

        payment.reload
        expect(payment.failure_reason).to eq("Payment failed")
      end
    end

    context "when payment metadata already has data" do
      before do
        payment.update!(metadata: { existing_key: "existing_value" })
        previous_cycle
      end

      it "merges cycle_data into existing metadata" do
        operation.call(valid_params)

        payment.reload
        expect(payment.metadata["existing_key"]).to eq("existing_value")
        # cycle_data contains the validated params (only Contract fields)
        expect(payment.metadata["cycle_data"]).to include(
          "plan_id" => valid_params[:plan_id],
          "id" => valid_params[:id],
          "cycle_number" => valid_params[:cycle_number],
          "reference_id" => valid_params[:reference_id]
        )
      end
    end
  end
end
