# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Finance::Subscriptions", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  before do
    create(:space_user, space:, user:)
  end

  describe "GET /api/v1/finance/subscriptions" do
    let(:list_plans_query) { instance_double(Finance::Queries::ListSubscriptionPlans) }
    let(:subscription_plan) { create(:subscription_plan, slug: "basic-#{SecureRandom.hex(4)}", token_limit: 50, price_cents: 14_900, interval: "month") }

    before do
      allow(Finance::Queries::ListSubscriptionPlans).to receive(:call).and_return(
        Dry::Monads::Success([subscription_plan])
      )
    end

    context "when request is successful" do
      it "returns HTTP status ok" do
        get "/api/v1/finance/subscriptions", headers: headers

        expect(response).to have_http_status(:ok)
      end

      it "returns subscription plans in response" do
        get "/api/v1/finance/subscriptions", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(true)
        expect(json_response["data"]).to have_key("subscriptionPlans")
        expect(json_response["data"]["subscriptionPlans"]).to be_an(Array)
      end
    end

    context "when query fails" do
      before do
        allow(Finance::Queries::ListSubscriptionPlans).to receive(:call).and_return(
          Dry::Monads::Failure(plans: "not found")
        )
      end

      it "returns HTTP status unprocessable_content" do
        get "/api/v1/finance/subscriptions", headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end

      it "returns error details in response" do
        get "/api/v1/finance/subscriptions", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(false)
        expect(json_response["error"]).to have_key("details")
      end
    end
  end

  describe "GET /api/v1/finance/subscriptions/current_subscriptions" do
    let(:get_current_subscriptions_operation) do
      instance_double(Finance::Operations::Subscriptions::GetCurrentSubscriptions)
    end
    let(:space_subscription) do
      create(
        :space_subscription,
        space: space,
        status: "active"
      )
    end

    before do
      allow(Finance::Operations::Subscriptions::GetCurrentSubscriptions).to receive(:new)
        .and_return(get_current_subscriptions_operation)
    end

    context "when request is successful with subscriptions" do
      before do
        allow(get_current_subscriptions_operation).to receive(:call).and_return(
          Dry::Monads::Success([space_subscription])
        )
      end

      it "returns HTTP status ok" do
        get "/api/v1/finance/subscriptions/current_subscriptions", headers: headers

        expect(response).to have_http_status(:ok)
      end

      it "returns subscriptions in response" do
        get "/api/v1/finance/subscriptions/current_subscriptions", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(true)
        expect(json_response["data"]).to have_key("subscriptions")
        expect(json_response["data"]["subscriptions"]).to be_an(Array)
      end
    end

    context "when request is successful with no subscriptions" do
      before do
        allow(get_current_subscriptions_operation).to receive(:call).and_return(
          Dry::Monads::Success([])
        )
      end

      it "returns empty subscriptions array" do
        get "/api/v1/finance/subscriptions/current_subscriptions", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(true)
        expect(json_response["data"]["subscriptions"]).to eq([])
      end
    end

    context "when operation fails" do
      before do
        allow(get_current_subscriptions_operation).to receive(:call).and_return(
          Dry::Monads::Failure(space_id: "not found")
        )
      end

      it "returns HTTP status unprocessable_content" do
        get "/api/v1/finance/subscriptions/current_subscriptions", headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  describe "POST /api/v1/finance/subscriptions" do
    let(:create_subscription_operation) do
      instance_double(Finance::Operations::Subscriptions::CreateSubscription)
    end
    let(:subscription_plan) { create(:subscription_plan, slug: "basic-#{SecureRandom.hex(4)}", token_limit: 50, price_cents: 14_900, interval: "month") }
    let(:space_subscription) do
      create(
        :space_subscription,
        space: space,
        subscription_plan: subscription_plan,
        status: "active"
      )
    end
    let(:valid_params) do
      {
        space_id: space.id.to_s,
        subscription_plan_id: subscription_plan.id.to_s
      }
    end

    before do
      allow(Finance::Operations::Subscriptions::CreateSubscription).to receive(:new)
        .and_return(create_subscription_operation)
    end

    context "when request is successful" do
      before do
        allow(create_subscription_operation).to receive(:call).and_return(
          Dry::Monads::Success(
            space_subscription: space_subscription,
            action_url: "https://example.com/action",
            status: "ACTIVE"
          )
        )
      end

      it "returns HTTP status created" do
        post "/api/v1/finance/subscriptions", params: valid_params, headers: headers

        expect(response).to have_http_status(:created)
      end

      it "returns subscription data in response" do
        post "/api/v1/finance/subscriptions", params: valid_params, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(true)
        expect(json_response["data"]).to have_key("subscription")
        expect(json_response["data"]).to have_key("actionUrl")
        expect(json_response["data"]).to have_key("status")
      end
    end

    context "when operation fails" do
      before do
        allow(create_subscription_operation).to receive(:call).and_return(
          Dry::Monads::Failure(space_id: "not found")
        )
      end

      it "returns HTTP status unprocessable_content" do
        post "/api/v1/finance/subscriptions", params: valid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  describe "PATCH /api/v1/finance/subscriptions/:id" do
    let(:update_subscription_operation) do
      instance_double(Finance::Operations::Subscriptions::UpdateSubscription)
    end
    let(:subscription_plan) { create(:subscription_plan, slug: "basic-#{SecureRandom.hex(4)}", token_limit: 50, price_cents: 14_900, interval: "month") }
    let(:new_plan) { create(:subscription_plan, slug: "premium-#{SecureRandom.hex(4)}", token_limit: 100, price_cents: 20_000, interval: "month") }
    let(:space_subscription) do
      create(
        :space_subscription,
        space: space,
        subscription_plan: subscription_plan,
        status: "active"
      )
    end
    let(:valid_params) do
      {
        subscription_plan_id: new_plan.id.to_s
      }
    end

    before do
      allow(Finance::Operations::Subscriptions::UpdateSubscription).to receive(:new)
        .and_return(update_subscription_operation)
    end

    context "when request is successful" do
      before do
        allow(update_subscription_operation).to receive(:call).and_return(
          Dry::Monads::Success(
            space_subscription: space_subscription,
            payment_session: nil,
            message: "Subscription updated successfully"
          )
        )
      end

      it "returns HTTP status ok" do
        patch "/api/v1/finance/subscriptions/#{space_subscription.id}", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
      end

      it "returns subscription data in response" do
        patch "/api/v1/finance/subscriptions/#{space_subscription.id}", params: valid_params, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(true)
        expect(json_response["data"]).to have_key("subscription")
        expect(json_response["message"]).to eq("Subscription updated successfully")
      end
    end

    context "when request is successful with payment session" do
      before do
        allow(update_subscription_operation).to receive(:call).and_return(
          Dry::Monads::Success(
            space_subscription: space_subscription,
            payment_session: {
              payment_link_url: "https://example.com/pay"
            },
            message: "Payment required to complete plan upgrade"
          )
        )
      end

      it "returns payment session URL in response" do
        patch "/api/v1/finance/subscriptions/#{space_subscription.id}", params: valid_params, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"]).to have_key("paymentSessionUrl")
        expect(json_response["data"]["paymentSessionUrl"]).to eq("https://example.com/pay")
      end
    end

    context "when operation fails" do
      before do
        allow(update_subscription_operation).to receive(:call).and_return(
          Dry::Monads::Failure(subscription_id: "not found")
        )
      end

      it "returns HTTP status unprocessable_content" do
        patch "/api/v1/finance/subscriptions/#{space_subscription.id}", params: valid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  describe "POST /api/v1/finance/subscriptions/:id/cancel" do
    let(:cancel_subscription_operation) do
      instance_double(Finance::Operations::Subscriptions::CancelSubscription)
    end
    let(:subscription_plan) { create(:subscription_plan, slug: "basic-#{SecureRandom.hex(4)}", token_limit: 50, price_cents: 14_900, interval: "month") }
    let(:space_subscription) do
      create(
        :space_subscription,
        space: space,
        subscription_plan: subscription_plan,
        status: "active"
      )
    end

    before do
      allow(Finance::Operations::Subscriptions::CancelSubscription).to receive(:new)
        .and_return(cancel_subscription_operation)
    end

    context "when request is successful" do
      before do
        allow(cancel_subscription_operation).to receive(:call).and_return(
          Dry::Monads::Success(space_subscription)
        )
      end

      it "returns HTTP status ok" do
        post "/api/v1/finance/subscriptions/#{space_subscription.id}/cancel", headers: headers

        expect(response).to have_http_status(:ok)
      end

      it "returns subscription data in response" do
        post "/api/v1/finance/subscriptions/#{space_subscription.id}/cancel", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(true)
        expect(json_response["data"]).to have_key("subscription")
        expect(json_response["message"]).to eq("Subscription cancelled successfully")
      end
    end

    context "when operation fails" do
      before do
        allow(cancel_subscription_operation).to receive(:call).and_return(
          Dry::Monads::Failure(subscription_id: "not found")
        )
      end

      it "returns HTTP status unprocessable_content" do
        post "/api/v1/finance/subscriptions/#{space_subscription.id}/cancel", headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  describe "POST /api/v1/finance/subscriptions/simulate_cycle_payment" do
    let(:simulate_cycle_payment_operation) do
      instance_double(Finance::Operations::Subscriptions::SimulateCyclePayment)
    end
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: create(:space_subscription, space: space),
        cycle_number: 1
      )
    end
    let(:valid_params) do
      {
        billing_cycle_id: billing_cycle.id.to_s,
        amount: 100.0
      }
    end

    before do
      allow(Finance::Operations::Subscriptions::SimulateCyclePayment).to receive(:new)
        .and_return(simulate_cycle_payment_operation)
      allow(Rails.env).to receive(:development?).and_return(true)
    end

    context "when in development environment" do
      before do
        allow(simulate_cycle_payment_operation).to receive(:call).and_return(
          Dry::Monads::Success({ message: "Payment simulated" })
        )
      end

      it "returns HTTP status ok" do
        post "/api/v1/finance/subscriptions/simulate_cycle_payment", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
      end

      it "returns success message" do
        post "/api/v1/finance/subscriptions/simulate_cycle_payment", params: valid_params, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(true)
        expect(json_response["message"]).to eq("Cycle payment simulated successfully")
      end
    end

    context "when in production environment" do
      before do
        allow(Rails.env).to receive(:development?).and_return(false)
        allow(Rails.env).to receive(:staging?).and_return(false)
      end

      it "returns HTTP status forbidden" do
        post "/api/v1/finance/subscriptions/simulate_cycle_payment", params: valid_params, headers: headers

        expect(response).to have_http_status(:forbidden)
      end

      it "returns error message" do
        post "/api/v1/finance/subscriptions/simulate_cycle_payment", params: valid_params, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(false)
        expect(json_response["error"]["message"]).to include("only available in development or staging")
      end
    end

    context "when operation fails" do
      before do
        allow(simulate_cycle_payment_operation).to receive(:call).and_return(
          Dry::Monads::Failure(billing_cycle_id: "not found")
        )
      end

      it "returns HTTP status unprocessable_content" do
        post "/api/v1/finance/subscriptions/simulate_cycle_payment", params: valid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  describe "POST /api/v1/finance/subscriptions/force_attempt_cycle" do
    let(:force_attempt_cycle_operation) do
      instance_double(Finance::Operations::Subscriptions::ForceAttemptCycle)
    end
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: create(:space_subscription, space: space),
        cycle_number: 1
      )
    end
    let(:valid_params) do
      {
        billing_cycle_id: billing_cycle.id.to_s
      }
    end

    before do
      allow(Finance::Operations::Subscriptions::ForceAttemptCycle).to receive(:new)
        .and_return(force_attempt_cycle_operation)
      allow(Rails.env).to receive(:development?).and_return(true)
    end

    context "when in development environment" do
      before do
        allow(force_attempt_cycle_operation).to receive(:call).and_return(
          Dry::Monads::Success({ message: "Force attempt initiated" })
        )
      end

      it "returns HTTP status ok" do
        post "/api/v1/finance/subscriptions/force_attempt_cycle", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
      end

      it "returns success message" do
        post "/api/v1/finance/subscriptions/force_attempt_cycle", params: valid_params, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(true)
        expect(json_response["message"]).to eq("Cycle force attempt initiated successfully")
      end
    end

    context "when in production environment" do
      before do
        allow(Rails.env).to receive(:development?).and_return(false)
        allow(Rails.env).to receive(:staging?).and_return(false)
      end

      it "returns HTTP status forbidden" do
        post "/api/v1/finance/subscriptions/force_attempt_cycle", params: valid_params, headers: headers

        expect(response).to have_http_status(:forbidden)
      end

      it "returns error message" do
        post "/api/v1/finance/subscriptions/force_attempt_cycle", params: valid_params, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(false)
        expect(json_response["error"]["message"]).to include("only available in development or staging")
      end
    end

    context "when operation fails" do
      before do
        allow(force_attempt_cycle_operation).to receive(:call).and_return(
          Dry::Monads::Failure(billing_cycle_id: "not found")
        )
      end

      it "returns HTTP status unprocessable_content" do
        post "/api/v1/finance/subscriptions/force_attempt_cycle", params: valid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end
end
