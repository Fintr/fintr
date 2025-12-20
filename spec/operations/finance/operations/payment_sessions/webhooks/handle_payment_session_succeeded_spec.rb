# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::PaymentSessions::Webhooks::HandlePaymentSessionSucceeded, type: :operation do
  let(:operation) { described_class.new }
  let(:space) { create(:space) }
  let(:old_plan) { create(:subscription_plan, price_cents: 14_900) }
  let(:new_plan) { create(:subscription_plan, :standard, price_cents: 25_000) }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: old_plan,
      xendit_plan_id: "plan-test-123"
    )
  end
  let(:payment_session_id) { "ps-692c1235a6e5f2d96830948b" }
  let(:current_cycle) do
    create(
      :finance_billing_cycle,
      space_subscription: space_subscription,
      cycle_number: 1,
      status: "paid",
      span: (1.month.ago.beginning_of_month..Time.zone.now.end_of_month)
    )
  end

  let(:valid_params) do
    {
      id: payment_session_id,
      status: "COMPLETED",
      reference_id: "ref-123",
      amount: 250.0,
      currency: "PHP",
      payment_id: "py-77dd5855-5f59-460f-97d3-2d03e8af41e0"
    }
  end

  before do
    allow(Rails.logger).to receive(:info)
    allow(Rails.logger).to receive(:error)
    allow(ActionCable.server).to receive(:broadcast)
  end

  describe "#validate" do
    context "with valid parameters using id" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with valid parameters using payment_session_id" do
      it "returns success and normalizes to id" do
        params = valid_params.except(:id).merge(payment_session_id: payment_session_id)

        result = operation.validate(params: params)

        expect(result).to be_success
        expect(result.value![:id]).to eq(payment_session_id)
        expect(result.value!).not_to have_key(:payment_session_id)
      end
    end

    context "with missing id and payment_session_id" do
      it "returns failure" do
        params = valid_params.except(:id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:id)
      end
    end

    context "with missing status" do
      it "returns failure" do
        params = valid_params.except(:status)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:status)
      end
    end
  end

  describe "#call" do
    context "with valid parameters and pending plan change with cycle" do
      let(:pending_change) do
        {
          "pending" => true,
          "payment_session_id" => payment_session_id,
          "new_plan_id" => new_plan.id,
          "current_cycle_id" => current_cycle.id,
          "requested_at" => Time.zone.now.iso8601,
          "proration" => {
            "prorated_amount_cents" => 10_000,
            "current_cycle_start" => current_cycle.started_at.iso8601,
            "current_cycle_end" => current_cycle.ends_at.iso8601
          }
        }
      end

      before do
        space_subscription.update!(
          metadata: { "pending_plan_change" => pending_change }
        )
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(
          instance_double(Integrations::Payments::Xendit::Client, update_subscription_plan: true)
        )
      end

      it "returns success with subscription_id and new_plan_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:subscription_id]).to eq(space_subscription.id)
        expect(response[:new_plan_id]).to eq(new_plan.id)
        expect(response[:message]).to eq("Plan upgrade completed successfully")
      end

      it "creates prorated cycle" do
        expect do
          operation.call(valid_params)
        end.to change(Finance::BillingCycle, :count).by(1)

        prorated_cycle = Finance::BillingCycle.order(created_at: :desc).first
        expect(prorated_cycle.cycle_number).to be > 1.0
        expect(prorated_cycle.cycle_number).to be < 2.0
        expect(prorated_cycle.status).to eq("paid")
        expect(prorated_cycle.metadata["prorated"]).to be(true)
      end

      it "creates payment for prorated cycle" do
        expect do
          operation.call(valid_params)
        end.to change(Finance::Payment, :count).by(1)

        payment = Finance::Payment.last
        expect(payment.status).to eq("succeeded")
        expect(payment.billing_cycle).to be_present
        expect(payment.metadata["type"]).to eq("proration")
      end

      it "marks prorated cycle as paid" do
        operation.call(valid_params)

        prorated_cycle = Finance::BillingCycle.where("cycle_number = 1.1").first
        expect(prorated_cycle.status).to eq("paid")
        expect(prorated_cycle.paid_at).to be_present
      end

      it "clears pending plan change" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.metadata["pending_plan_change"]).to be_nil
      end

      it "broadcasts subscription update" do
        expect(ActionCable.server).to receive(:broadcast).with(
          "subscriptions:#{space.id}",
          hash_including(
            type: "subscription_updated",
            subscription_id: space_subscription.id,
            space_id: space.id
          )
        )

        operation.call(valid_params)
      end

      it "updates Xendit subscription plan" do
        client = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)

        expect(client).to receive(:update_subscription_plan).with(
          plan_id: space_subscription.xendit_plan_id,
          params: {
            amount: 250.0,
            currency: new_plan.price_currency
          }
        )

        operation.call(valid_params)
      end

      it "updates upcoming cycles tokens" do
        future_cycle = create(
          :finance_billing_cycle,
          :future,
          space_subscription: space_subscription,
          cycle_number: 2,
          tokens_allocated: old_plan.token_limit
        )

        operation.call(valid_params)

        future_cycle.reload
        expect(future_cycle.tokens_allocated).to eq(new_plan.token_limit)
      end
    end

    context "with valid parameters and pending plan change without cycle" do
      let(:pending_change) do
        {
          "pending" => true,
          "payment_session_id" => payment_session_id,
          "new_plan_id" => new_plan.id,
          "no_current_cycle" => true,
          "charge_full_amount" => true,
          "amount_cents" => 25_000,
          "requested_at" => Time.zone.now.iso8601
        }
      end

      before do
        space_subscription.update!(
          metadata: { "pending_plan_change" => pending_change }
        )
        client = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)
        allow(client).to receive(:update_subscription_plan).and_return(true)
      end

      it "returns failure because payment requires billing cycle" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
      end
    end

    context "when subscription is not found" do
      it "returns failure" do
        params = valid_params.merge(id: "non-existent-id")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
      end
    end

    context "when pending plan change is not found" do
      before do
        space_subscription.update!(
          metadata: {
            "pending_plan_change" => {
              "payment_session_id" => payment_session_id
            }
          }
        )
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:pending_change)
      end
    end

    context "when pending plan change is not pending" do
      before do
        space_subscription.update!(
          metadata: {
            "pending_plan_change" => {
              "pending" => false,
              "payment_session_id" => payment_session_id,
              "new_plan_id" => new_plan.id
            }
          }
        )
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:pending_change)
      end
    end

    context "when payment session id mismatch" do
      let(:different_payment_session_id) { "different-id" }

      before do
        # Set up subscription with different payment_session_id in metadata
        # This simulates a scenario where the subscription was set up with one payment session
        # but the webhook is for a different payment session
        space_subscription.update!(
          metadata: {
            "pending_plan_change" => {
              "pending" => true,
              "payment_session_id" => different_payment_session_id,
              "new_plan_id" => new_plan.id,
              "current_cycle_id" => current_cycle.id,
              "proration" => {
                "prorated_amount_cents" => 10_000,
                "current_cycle_start" => current_cycle.started_at.iso8601,
                "current_cycle_end" => current_cycle.ends_at.iso8601
              }
            }
          }
        )
      end

      it "returns failure because subscription is not found" do
        # Since the payment_session_id doesn't match, the subscription won't be found
        # This is the actual behavior - the operation fails at the subscription lookup step
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
      end
    end

    context "when new plan is not found" do
      before do
        space_subscription.update!(
          metadata: {
            "pending_plan_change" => {
              "pending" => true,
              "payment_session_id" => payment_session_id,
              "new_plan_id" => 99_999
            }
          }
        )
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:new_plan_id)
      end
    end

    context "when new plan is not active" do
      let(:inactive_plan) { create(:subscription_plan, slug: "inactive-plan-#{SecureRandom.hex(4)}", active: false) }

      before do
        space_subscription.update!(
          metadata: {
            "pending_plan_change" => {
              "pending" => true,
              "payment_session_id" => payment_session_id,
              "new_plan_id" => inactive_plan.id
            }
          }
        )
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:new_plan_id)
      end
    end

    context "when current cycle is not found for proration" do
      before do
        space_subscription.update!(
          metadata: {
            "pending_plan_change" => {
              "pending" => true,
              "payment_session_id" => payment_session_id,
              "new_plan_id" => new_plan.id,
              "current_cycle_id" => 99_999,
              "proration" => {
                "prorated_amount_cents" => 10_000
              }
            }
          }
        )
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:current_cycle)
      end
    end

    context "when no prorated cycle is needed" do
      let(:pending_change) do
        {
          "pending" => true,
          "payment_session_id" => payment_session_id,
          "new_plan_id" => new_plan.id,
          "current_cycle_id" => current_cycle.id,
          "requested_at" => current_cycle.ends_at.iso8601,
          "proration" => {
            "prorated_amount_cents" => 10_000,
            "current_cycle_start" => current_cycle.started_at.iso8601,
            "current_cycle_end" => current_cycle.ends_at.iso8601
          }
        }
      end

      before do
        space_subscription.update!(
          metadata: { "pending_plan_change" => pending_change }
        )
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(
          instance_double(Integrations::Payments::Xendit::Client, update_subscription_plan: true)
        )
      end

      it "does not create prorated cycle" do
        expect do
          operation.call(valid_params)
        end.not_to change(Finance::BillingCycle, :count)
      end

      it "does not create payment" do
        expect do
          operation.call(valid_params)
        end.not_to change(Finance::Payment, :count)
      end

      it "updates subscription plan" do
        operation.call(valid_params)

        space_subscription.reload
        expect(space_subscription.subscription_plan_id).to eq(new_plan.id)
      end
    end

    context "when Xendit client update fails" do
      let(:pending_change) do
        {
          "pending" => true,
          "payment_session_id" => payment_session_id,
          "new_plan_id" => new_plan.id,
          "current_cycle_id" => current_cycle.id,
          "requested_at" => Time.zone.now.iso8601,
          "proration" => {
            "prorated_amount_cents" => 10_000,
            "current_cycle_start" => current_cycle.started_at.iso8601,
            "current_cycle_end" => current_cycle.ends_at.iso8601
          }
        }
      end

      before do
        space_subscription.update!(
          metadata: { "pending_plan_change" => pending_change }
        )
        client = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)
        allow(client).to receive(:update_subscription_plan).and_raise(StandardError.new("Xendit error"))
      end

      it "returns failure with error message" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Xendit error")
      end
    end

    context "when broadcasting fails" do
      let(:pending_change) do
        {
          "pending" => true,
          "payment_session_id" => payment_session_id,
          "new_plan_id" => new_plan.id,
          "current_cycle_id" => current_cycle.id,
          "requested_at" => Time.zone.now.iso8601,
          "proration" => {
            "prorated_amount_cents" => 10_000,
            "current_cycle_start" => current_cycle.started_at.iso8601,
            "current_cycle_end" => current_cycle.ends_at.iso8601
          }
        }
      end

      before do
        space_subscription.update!(
          metadata: { "pending_plan_change" => pending_change }
        )
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(
          instance_double(Integrations::Payments::Xendit::Client, update_subscription_plan: true)
        )
        allow(ActionCable.server).to receive(:broadcast).and_raise(StandardError.new("Broadcast error"))
      end

      it "logs error but does not fail" do
        expect(Rails.logger).to receive(:error).with(
          include("Failed to broadcast subscription update")
        )

        result = operation.call(valid_params)
        expect(result).to be_success
      end
    end
  end
end
