# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::UpdateSubscription, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:old_plan) { create(:subscription_plan, slug: "basic-#{SecureRandom.hex(4)}", token_limit: 50, price_cents: 10_000, interval: "month", active: true) }
  let(:new_plan) { create(:subscription_plan, slug: "premium-#{SecureRandom.hex(4)}", token_limit: 100, price_cents: 20_000, interval: "month", active: true) }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: old_plan,
      status: "active"
    )
  end

  let(:valid_params) do
    {
      space_id: space.id.to_s,
      subscription_id: space_subscription.id.to_s,
      new_subscription_plan_id: new_plan.id.to_s
    }
  end

  before do
    create(:space_user, space:, user:)
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with missing space_id" do
      it "returns failure" do
        params = valid_params.except(:space_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end
    end

    context "with missing subscription_id" do
      it "returns failure" do
        params = valid_params.except(:subscription_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_id)
      end
    end

    context "with missing new_subscription_plan_id" do
      it "returns failure" do
        params = valid_params.except(:new_subscription_plan_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:new_subscription_plan_id)
      end
    end

    context "with optional effective_date" do
      it "returns success when effective_date is provided" do
        params = valid_params.merge(effective_date: Time.zone.now.to_datetime)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    let(:calculate_proration_operation) do
      instance_double(Finance::Operations::Subscriptions::CalculateProration)
    end
    let(:client_mock) { instance_double(Integrations::Payments::Xendit::Client) }

    before do
      allow(Finance::Operations::Subscriptions::CalculateProration).to receive(:new)
        .and_return(calculate_proration_operation)
      allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
    end

    context "with invalid parameters" do
      it "returns failure when space_id is invalid" do
        params = valid_params.merge(space_id: "invalid")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end

      it "returns failure when subscription_id is invalid" do
        params = valid_params.merge(subscription_id: "invalid")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_id)
      end

      it "returns failure when new_subscription_plan_id is invalid" do
        params = valid_params.merge(new_subscription_plan_id: "invalid")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:new_subscription_plan_id)
      end
    end

    context "when space is not found" do
      it "returns failure" do
        params = valid_params.merge(space_id: "999999")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
        expect(result.failure[:space_id]).to eq("not found")
      end
    end

    context "when subscription is not found" do
      it "returns failure" do
        params = valid_params.merge(subscription_id: "999999")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_id)
        expect(result.failure[:subscription_id]).to eq("not found")
      end
    end

    context "when new plan is not found" do
      it "returns failure" do
        params = valid_params.merge(new_subscription_plan_id: "999999")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:new_subscription_plan_id)
        expect(result.failure[:new_subscription_plan_id]).to eq("not found")
      end
    end

    context "when new plan is not active" do
      let(:inactive_plan) do
        create(
          :subscription_plan,
          slug: "inactive-#{SecureRandom.hex(4)}",
          token_limit: 100,
          price_cents: 20_000,
          interval: "month",
          active: false
        )
      end

      it "returns failure" do
        params = valid_params.merge(new_subscription_plan_id: inactive_plan.id.to_s)

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:new_subscription_plan_id)
        expect(result.failure[:new_subscription_plan_id]).to eq("plan is not active")
      end
    end

    context "when subscription is not active" do
      before do
        space_subscription.update!(status: "inactive")
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
        expect(result.failure[:subscription]).to include("must be active to update")
      end
    end

    context "when subscription has failed billing cycles" do
      before do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1,
          status: "failed"
        )
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
        expect(result.failure[:subscription]).to include("cannot change plan with failed billing cycles")
      end
    end

    context "when plan already changed for current billing cycle" do
      let(:current_cycle) do
        create(
          :finance_billing_cycle,
          :paid,
          space_subscription: space_subscription,
          cycle_number: 1,
          span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
        )
      end

      before do
        current_cycle
        space_subscription.update!(
          metadata: {
            "plan_change" => {
              "changed_at" => Time.zone.now.iso8601
            }
          }
        )
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
        expect(result.failure[:subscription]).to include("plan already changed for the billing cycle")
      end
    end

    context "when prorated cycle already exists for current cycle" do
      let(:current_cycle) do
        create(
          :finance_billing_cycle,
          :paid,
          space_subscription: space_subscription,
          cycle_number: 1,
          span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
        )
      end
      let(:prorated_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1.1,
          metadata: { "prorated" => "true" }
        )
      end

      before do
        current_cycle
        prorated_cycle
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
        expect(result.failure[:subscription]).to include("plan already changed for the billing cycle")
      end
    end

    context "when same plan is selected" do
      let(:same_plan_params) do
        {
          space_id: space.id.to_s,
          subscription_id: space_subscription.id.to_s,
          new_subscription_plan_id: old_plan.id.to_s
        }
      end

      before do
        allow(calculate_proration_operation).to receive(:call).and_return(
          Success(
            no_proration: true,
            same_plan: true
          )
        )
      end

      it "returns success with same plan message" do
        result = operation.call(same_plan_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:message]).to eq("Same plan selected")
        expect(response[:payment_session]).to be_nil
        expect(response[:xendit_response]).to be_nil
      end
    end

    context "when no current paid cycle exists" do
      before do
        allow(calculate_proration_operation).to receive(:call).and_return(
          Success(
            no_proration: true,
            no_current_cycle: true
          )
        )
      end

      context "when upgrading" do
        before do
          allow(client_mock).to receive(:create_payment_session).and_return(
            {
              id: "ps-test-123",
              payment_link_url: "https://example.com/pay"
            }
          )
        end

        it "creates payment session and stores pending plan change" do
          result = operation.call(valid_params)

          expect(result).to be_success
          response = result.value!
          expect(response[:payment_session]).to be_present
          expect(response[:message]).to include("Payment required")

          space_subscription.reload
          expect(space_subscription.metadata["pending_plan_change"]).to be_present
          expect(space_subscription.metadata["pending_plan_change"]["pending"]).to be(true)
        end
      end

      context "when downgrading" do
        let(:downgrade_plan) do
          create(
            :subscription_plan,
            slug: "starter-#{SecureRandom.hex(4)}",
            token_limit: 25,
            price_cents: 5_000,
            interval: "month",
            active: true
          )
        end
        let(:downgrade_params) do
          {
            space_id: space.id.to_s,
            subscription_id: space_subscription.id.to_s,
            new_subscription_plan_id: downgrade_plan.id.to_s
          }
        end

        before do
          allow(client_mock).to receive(:update_subscription_plan).and_return(
            {
              id: "repl_test_123",
              status: "ACTIVE"
            }
          )
        end

        it "updates plan immediately without payment" do
          result = operation.call(downgrade_params)

          expect(result).to be_success
          response = result.value!
          expect(response[:xendit_response]).to be_present
          expect(response[:message]).to include("Plan downgraded")

          space_subscription.reload
          expect(space_subscription.subscription_plan_id).to eq(downgrade_plan.id)
        end
      end
    end

    context "when upgrade is required" do
      let(:current_cycle) do
        create(
          :finance_billing_cycle,
          :paid,
          space_subscription: space_subscription,
          cycle_number: 1,
          span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
        )
      end

      before do
        current_cycle
        allow(calculate_proration_operation).to receive(:call).and_return(
          Success(
            no_proration: false,
            action: "upgrade",
            prorated_amount_cents: 5_000,
            current_cycle: current_cycle
          )
        )
        allow(client_mock).to receive(:create_payment_session).and_return(
          {
            id: "ps-test-123",
            payment_link_url: "https://example.com/pay"
          }
        )
      end

      it "creates payment session and stores pending plan change" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:payment_session]).to be_present
        expect(response[:message]).to include("Payment required")

        space_subscription.reload
        expect(space_subscription.metadata["pending_plan_change"]).to be_present
        expect(space_subscription.metadata["pending_plan_change"]["pending"]).to be(true)
        expect(space_subscription.metadata["pending_plan_change"]["action"]).to eq("upgrade")
      end
    end

    context "when downgrade is required" do
      let(:downgrade_plan) do
        create(
          :subscription_plan,
          slug: "starter-#{SecureRandom.hex(4)}",
          token_limit: 25,
          price_cents: 5_000,
          interval: "month",
          active: true
        )
      end
      let(:downgrade_params) do
        {
          space_id: space.id.to_s,
          subscription_id: space_subscription.id.to_s,
          new_subscription_plan_id: downgrade_plan.id.to_s
        }
      end
      let(:current_cycle) do
        create(
          :finance_billing_cycle,
          :paid,
          space_subscription: space_subscription,
          cycle_number: 1,
          span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
        )
      end

      before do
        current_cycle
        allow(calculate_proration_operation).to receive(:call).and_return(
          Success(
            no_proration: false,
            action: "downgrade",
            prorated_amount_cents: -2_500,
            current_cycle: current_cycle
          )
        )
        allow(client_mock).to receive(:update_subscription_plan).and_return(
          {
            id: "repl_test_123",
            status: "ACTIVE"
          }
        )
      end

      it "updates plan immediately without payment" do
        result = operation.call(downgrade_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:xendit_response]).to be_present

        space_subscription.reload
        expect(space_subscription.subscription_plan_id).to eq(downgrade_plan.id)
        expect(space_subscription.metadata["plan_change"]["action"]).to eq("downgrade")
      end
    end

    context "when Xendit API returns an error" do
      let(:current_cycle) do
        create(
          :finance_billing_cycle,
          :paid,
          space_subscription: space_subscription,
          cycle_number: 1,
          span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
        )
      end

      before do
        current_cycle
        allow(calculate_proration_operation).to receive(:call).and_return(
          Success(
            no_proration: false,
            action: "upgrade",
            prorated_amount_cents: 5_000,
            current_cycle: current_cycle
          )
        )
        allow(client_mock).to receive(:create_payment_session)
          .and_raise(Integrations::Payments::Xendit::Error.new(
            message: "Payment session creation failed",
            status: 400,
            code: "INVALID_REQUEST"
          ))
      end

      it "returns failure with Xendit error details" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:xendit_error)
        expect(result.failure[:status]).to eq(400)
      end
    end

    context "when calculate proration returns failure" do
      before do
        allow(calculate_proration_operation).to receive(:call).and_return(
          Failure(proration: "calculation failed")
        )
      end

      it "returns failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:proration)
      end
    end
  end
end
