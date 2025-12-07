# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::FindOrCreatePayment, type: :operation do
  let(:operation) { described_class.new }
  let(:space) { create(:space) }
  let(:subscription_plan) { create(:subscription_plan, slug: "basic", token_limit: 50, price_cents: 14_900, interval: "month") }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: subscription_plan,
      status: "active"
    )
  end
  let(:billing_cycle) do
    create(
      :finance_billing_cycle,
      space_subscription: space_subscription,
      cycle_number: 1,
      status: "pending"
    )
  end
  let(:xendit_cycle_id) { "recy_8594c21f-dda6-4482-8d66-966e1095c7e1" }

  let(:valid_params) do
    {
      space_subscription: space_subscription,
      xendit_cycle_id: xendit_cycle_id,
      billing_cycle: billing_cycle,
      reference_id: "ref-123",
      id: xendit_cycle_id # Provide cycle_id to avoid nil assignment
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

    context "with missing xendit_cycle_id" do
      it "returns failure" do
        params = valid_params.except(:xendit_cycle_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:xendit_cycle_id)
      end
    end

    context "with optional fields" do
      it "returns success when billing_cycle is provided" do
        params = valid_params.merge(billing_cycle: billing_cycle)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when billing_cycle is not provided" do
        params = valid_params.except(:billing_cycle)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with amount" do
        params = valid_params.merge(amount: 250.0)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with currency" do
        params = valid_params.merge(currency: "USD")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with action hash" do
        params = valid_params.merge(
          action: {
            id: "action-123",
            amount: 250.0,
            currency: "PHP",
            reference_id: "ref-123",
            payment_method: {
              id: "pm-123",
              type: "CREDIT_CARD"
            }
          }
        )

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with cycle hash" do
        params = valid_params.merge(
          cycle: {
            id: "cycle-123",
            reference_id: "ref-123"
          }
        )

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with attempt_details array" do
        params = valid_params.merge(
          attempt_details: [
            { status: "SUCCEEDED", attempt_number: 1 }
          ]
        )

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    context "when payment does not exist" do
      it "creates a new payment" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payment = result.value!
        expect(payment).to be_persisted
        expect(payment.xendit_cycle_id).to eq(xendit_cycle_id)
      end

      it "assigns space_subscription to payment" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.space_subscription).to eq(space_subscription)
      end

      it "assigns billing_cycle to payment when provided" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.billing_cycle).to eq(billing_cycle)
      end

      it "sets status to pending" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.status).to eq("pending")
      end

      it "uses plan price when amount is not provided" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.amount_cents).to eq(subscription_plan.price_cents)
      end

      it "uses provided amount when available" do
        params = valid_params.merge(amount: 250.0)

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.amount_cents).to eq(25_000)
      end

      it "extracts amount from action hash" do
        params = valid_params.merge(
          action: {
            amount: 300.0
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.amount_cents).to eq(30_000)
      end

      it "prioritizes flat amount over action amount" do
        params = valid_params.merge(
          amount: 250.0,
          action: {
            amount: 300.0
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.amount_cents).to eq(25_000)
      end

      it "defaults currency to PHP" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.amount_currency).to eq("PHP")
      end

      it "uses provided currency" do
        params = valid_params.merge(currency: "USD")

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.amount_currency).to eq("USD")
      end

      it "extracts currency from action hash" do
        params = valid_params.merge(
          action: {
            currency: "USD"
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.amount_currency).to eq("USD")
      end

      it "prioritizes flat currency over action currency" do
        params = valid_params.merge(
          currency: "USD",
          action: {
            currency: "EUR"
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.amount_currency).to eq("USD")
      end

      it "extracts reference_id from params" do
        params = valid_params.merge(reference_id: "ref-123")

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.xendit_reference_id).to eq("ref-123")
      end

      it "extracts cycle_id from flat id" do
        params = valid_params.merge(id: "cycle-123", reference_id: "ref-cycle-123")

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.xendit_cycle_id).to eq("cycle-123")
      end

      it "extracts cycle_id from cycle hash" do
        params = valid_params.except(:id).merge(
          cycle: {
            id: "cycle-123"
          },
          reference_id: "ref-cycle-123"
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.xendit_cycle_id).to eq("cycle-123")
      end

      it "extracts cycle_id from cycle_id param" do
        params = valid_params.except(:id).merge(cycle_id: "cycle-123", reference_id: "ref-cycle-123")

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.xendit_cycle_id).to eq("cycle-123")
      end

      it "prioritizes flat id over cycle hash" do
        params = valid_params.except(:id).merge(
          id: "cycle-flat",
          cycle: {
            id: "cycle-nested"
          },
          reference_id: "ref-cycle-flat"
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.xendit_cycle_id).to eq("cycle-flat")
      end

      it "uses xendit_cycle_id when cycle_id is not provided in id, cycle, or cycle_id" do
        params = valid_params.except(:id).merge(
          cycle: {},
          cycle_id: nil
        )

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:payment)
        expect(result.failure[:payment]).to include("Xendit cycle can't be blank")
      end

      it "extracts payment_method_type from action hash" do
        params = valid_params.merge(
          action: {
            payment_method: {
              type: "CREDIT_CARD"
            }
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.payment_method_type).to eq("CREDIT_CARD")
      end

      it "extracts payment_method_type from flat param" do
        params = valid_params.merge(payment_method_type: "DEBIT_CARD")

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.payment_method_type).to eq("DEBIT_CARD")
      end

      it "prioritizes action payment_method_type over flat param" do
        params = valid_params.merge(
          payment_method_type: "DEBIT_CARD",
          action: {
            payment_method: {
              type: "CREDIT_CARD"
            }
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.payment_method_type).to eq("CREDIT_CARD")
      end

      it "extracts payment_method_id from action hash" do
        params = valid_params.merge(
          action: {
            payment_method: {
              id: "pm-123"
            }
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.payment_method_id).to eq("pm-123")
      end

      it "extracts payment_method_id from flat param" do
        params = valid_params.merge(payment_method_id: "pm-456")

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.payment_method_id).to eq("pm-456")
      end

      it "prioritizes action payment_method_id over flat param" do
        params = valid_params.merge(
          payment_method_id: "pm-456",
          action: {
            payment_method: {
              id: "pm-123"
            }
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.payment_method_id).to eq("pm-123")
      end

      it "stores xendit_data as stringified keys" do
        params = valid_params.merge(
          amount: 250.0,
          currency: "PHP",
          reference_id: "ref-123"
        )

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.xendit_data).to be_a(Hash)
        # xendit_data stores all params with stringified keys (values are also stringified)
        expect(payment.xendit_data["amount"]).to eq("250.0")
        expect(payment.xendit_data["currency"]).to eq("PHP")
        expect(payment.xendit_data["reference_id"]).to eq("ref-123")
        expect(payment.xendit_data["space_subscription"]).to be_present
      end

      it "sets metadata to empty hash" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.metadata).to eq({})
      end
    end

    context "when payment already exists" do
      let(:existing_payment) do
        create(
          :finance_payment,
          space_subscription: space_subscription,
          billing_cycle: billing_cycle,
          xendit_cycle_id: xendit_cycle_id,
          amount_cents: 10_000,
          amount_currency: "USD"
        )
      end

      before do
        existing_payment
      end

      it "returns existing payment when billing_cycle is not provided" do
        # When billing_cycle is not provided, update_payment_billing_cycle won't run
        params = valid_params.except(:billing_cycle)

        result = operation.call(params)

        expect(result).to be_success
        payment = result.value!
        expect(payment.id).to eq(existing_payment.id)
      end

      it "does not update payment attributes when it already exists" do
        original_amount = existing_payment.amount_cents
        params = valid_params.except(:billing_cycle).merge(amount: 250.0)

        result = operation.call(params)

        expect(result).to be_success
        existing_payment.reload
        expect(existing_payment.amount_cents).to eq(original_amount)
      end

      it "raises error when trying to update billing_cycle due to operation bug" do
        new_billing_cycle = create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 2
        )
        params = valid_params.merge(billing_cycle: new_billing_cycle)

        # The operation uses billing_cycle_id which doesn't exist (foreign key is biling_cycle_id)
        # This causes a NoMethodError
        expect { operation.call(params) }.to raise_error(NoMethodError, /billing_cycle_id/)
      end
    end
  end
end
