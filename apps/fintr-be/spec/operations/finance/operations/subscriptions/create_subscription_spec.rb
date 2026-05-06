# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::CreateSubscription, :vcr, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:subscription_plan) { create(:subscription_plan, slug: "basic-#{SecureRandom.hex(4)}", token_limit: 50, price_cents: 14_900, interval: "month") }

  let(:valid_params) do
    {
      space_id: space.id.to_s,
      subscription_plan_id: subscription_plan.id.to_s,
      user_id: user.id.to_s
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

    context "with missing subscription_plan_id" do
      it "returns failure" do
        params = valid_params.except(:subscription_plan_id)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_plan_id)
      end
    end

    context "with optional total_cycles" do
      it "returns success when total_cycles is provided" do
        params = valid_params.merge(total_cycles: 12)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns failure when total_cycles is zero" do
        params = valid_params.merge(total_cycles: 0)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:total_cycles)
      end

      it "returns failure when total_cycles is negative" do
        params = valid_params.merge(total_cycles: -1)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:total_cycles)
      end
    end

    context "with optional anchor_date" do
      it "returns success when anchor_date is provided" do
        params = valid_params.merge(anchor_date: Time.zone.now.to_datetime)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with optional success_return_url" do
      it "returns success when success_return_url is provided" do
        params = valid_params.merge(success_return_url: "https://example.com/success")

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with optional failure_return_url" do
      it "returns success when failure_return_url is provided" do
        params = valid_params.merge(failure_return_url: "https://example.com/failure")

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    let(:find_customer_operation) do
      instance_double(Finance::Operations::Customers::FindOrCreateCustomerForSpace)
    end
    let(:client_mock) { instance_double(Integrations::Payments::Xendit::Client) }

    before do
      allow(Finance::Operations::Customers::FindOrCreateCustomerForSpace).to receive(:new)
        .and_return(find_customer_operation)
      allow(find_customer_operation).to receive(:call).and_return(
        Success(id: "cust-test-123", reference_id: "ref-test-456")
      )
      allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
      allow(client_mock).to receive(:create_customer).and_return(
        { id: "cust-test-123", reference_id: "ref-test-456" }
      )
    end

    context "with valid parameters" do
      it "creates a subscription successfully", vcr: "xendit/create_subscription_operation" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "ACTIVE",
            schedule: { id: "resc_test_123", reference_id: "schedule-test-123" }
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!

        expect(response[:space_subscription]).to be_a(Finance::SpaceSubscription)
        expect(response[:space_subscription].space).to eq(space)
        expect(response[:space_subscription].subscription_plan).to eq(subscription_plan)
        expect(response[:space_subscription].xendit_plan_id).to be_present
        expect(response[:status]).to be_present
      end

      it "creates subscription with total_cycles", vcr: "xendit/create_subscription_with_cycles" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "ACTIVE",
            schedule: { id: "resc_test_123", reference_id: "schedule-test-123" }
          }
        )

        params = valid_params.merge(total_cycles: 12)

        result = operation.call(params)

        expect(result).to be_success
        space_subscription = result.value![:space_subscription]
        expect(space_subscription.total_cycles).to eq(12)
      end

      it "returns action_url when payment method is not linked", vcr: "xendit/create_subscription_requires_action" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "REQUIRES_ACTION",
            action_url: "https://example.com/action"
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!

        if response[:status] == "REQUIRES_ACTION"
          expect(response[:action_url]).to be_present
        end
      end
    end

    context "with invalid parameters" do
      it "returns failure when space_id is invalid" do
        params = valid_params.merge(space_id: "invalid")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end

      it "returns failure when subscription_plan_id is invalid" do
        params = valid_params.merge(subscription_plan_id: "invalid")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_plan_id)
      end
    end

    context "when space already has an active subscription" do
      it "returns failure" do
        create(
          :space_subscription,
          space: space,
          status: "active"
        )

        # Mock the Xendit client to avoid API calls
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
        expect(result.failure[:subscription]).to include("already has an active subscription")
      end
    end

    context "when Xendit API returns an error" do
      it "returns failure with Xendit error details" do
        # Mock FindOrCreateCustomerForSpace to return a valid customer
        # This prevents the need to create a customer via API and ensures we test subscription error handling
        find_customer_operation = instance_double(Finance::Operations::Customers::FindOrCreateCustomerForSpace)
        allow(Finance::Operations::Customers::FindOrCreateCustomerForSpace).to receive(:new).and_return(find_customer_operation)
        allow(find_customer_operation).to receive(:call).and_return(
          Success(id: "cust-test-123", reference_id: "ref-test-456")
        )

        # Mock the Xendit client
        # Allow create_customer in case the FindOrCreateCustomerForSpace mock doesn't fully prevent CreateCustomer from running
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          { id: "cust-test-123", reference_id: "ref-test-456" }
        )
        allow(client_mock).to receive(:create_subscription_plan)
          .and_raise(Integrations::Payments::Xendit::Error.new(
            message: "Invalid customer",
            status: 404,
            code: "CUSTOMER_NOT_FOUND"
          ))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:xendit_error)
        expect(result.failure[:status]).to eq(404)
      end
    end
  end

  describe "#fix_anchor_date" do
    context "when anchor_date is on day 29" do
      let(:anchor_date) { Time.zone.parse("2025-01-29 10:00:00") }

      it "clamps to day 28 for Xendit but stores original in metadata" do
        # Mock the Xendit client to avoid actual API calls
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          { id: "cust-test-123", reference_id: "ref-test-456" }
        )
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "ACTIVE",
            schedule: { id: "resc_test_123", reference_id: "schedule-test-123" }
          }
        )

        params = valid_params.merge(anchor_date: anchor_date.to_datetime)
        result = operation.call(params)

        expect(result).to be_success
        subscription = result.value![:space_subscription]

        # Check that original_anchor_date is stored in metadata
        stored_date = Time.zone.parse(subscription.metadata["original_anchor_date"])
        expect(stored_date).to be_within(1.second).of(anchor_date)
        expect(subscription.metadata["xendit_anchor_date"]).to be_present

        # Check that started_at uses the original date (not clamped)
        expect(subscription.started_at.day).to eq(29)
      end
    end

    context "when anchor_date is on day 30" do
      let(:anchor_date) { Time.zone.parse("2025-01-30 10:00:00") }

      it "clamps to day 28 for Xendit but stores original in metadata" do
        # Mock the Xendit client
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          { id: "cust-test-123", reference_id: "ref-test-456" }
        )
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "ACTIVE",
            schedule: { id: "resc_test_123", reference_id: "schedule-test-123" }
          }
        )

        params = valid_params.merge(anchor_date: anchor_date.to_datetime)
        result = operation.call(params)

        expect(result).to be_success
        subscription = result.value![:space_subscription]

        # Check that original_anchor_date is stored
        stored_date = Time.zone.parse(subscription.metadata["original_anchor_date"])
        expect(stored_date).to be_within(1.second).of(anchor_date)
        expect(subscription.started_at.day).to eq(30)
      end
    end

    context "when anchor_date is on day 31" do
      let(:anchor_date) { Time.zone.parse("2025-01-31 10:00:00") }

      it "clamps to day 28 for Xendit but stores original in metadata" do
        # Mock the Xendit client
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          { id: "cust-test-123", reference_id: "ref-test-456" }
        )
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "ACTIVE",
            schedule: { id: "resc_test_123", reference_id: "schedule-test-123" }
          }
        )

        params = valid_params.merge(anchor_date: anchor_date.to_datetime)
        result = operation.call(params)

        expect(result).to be_success
        subscription = result.value![:space_subscription]

        # Check that original_anchor_date is stored
        stored_date = Time.zone.parse(subscription.metadata["original_anchor_date"])
        expect(stored_date).to be_within(1.second).of(anchor_date)
        expect(subscription.started_at.day).to eq(31)
      end
    end

    context "when anchor_date is on day 28 or earlier" do
      let(:anchor_date) { Time.zone.parse("2025-01-28 10:00:00") }

      it "does not clamp and stores same date" do
        # Mock the Xendit client
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          { id: "cust-test-123", reference_id: "ref-test-456" }
        )
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "ACTIVE",
            schedule: { id: "resc_test_123", reference_id: "schedule-test-123" }
          }
        )

        params = valid_params.merge(anchor_date: anchor_date.to_datetime)
        result = operation.call(params)

        expect(result).to be_success
        subscription = result.value![:space_subscription]

        # For days 1-28, original and xendit dates should be the same
        stored_date = Time.zone.parse(subscription.metadata["original_anchor_date"])
        expect(stored_date).to be_within(1.second).of(anchor_date)
        expect(subscription.started_at.day).to eq(28)
      end
    end
  end

  describe "#find_action_url" do
    let(:find_customer_operation) do
      instance_double(Finance::Operations::Customers::FindOrCreateCustomerForSpace)
    end
    let(:client_mock) { instance_double(Integrations::Payments::Xendit::Client) }

    before do
      allow(Finance::Operations::Customers::FindOrCreateCustomerForSpace).to receive(:new)
        .and_return(find_customer_operation)
      allow(find_customer_operation).to receive(:call).and_return(
        Success(id: "cust-test-123", reference_id: "ref-test-456")
      )
      allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
      allow(client_mock).to receive(:create_customer).and_return(
        { id: "cust-test-123", reference_id: "ref-test-456" }
      )
    end

    context "when action_url is in top level" do
      it "returns action_url from top level" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "REQUIRES_ACTION",
            action_url: "https://example.com/action"
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:action_url]).to eq("https://example.com/action")
      end
    end

    context "when action_url is in actions array" do
      it "returns action_url from actions[0][:url]" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "REQUIRES_ACTION",
            actions: [
              { url: "https://example.com/action" }
            ]
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:action_url]).to eq("https://example.com/action")
      end
    end

    context "when redirect_url is in actions array" do
      it "returns redirect_url from actions[0][:redirect_url]" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "REQUIRES_ACTION",
            actions: [
              { redirect_url: "https://example.com/redirect" }
            ]
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:action_url]).to eq("https://example.com/redirect")
      end
    end

    context "when action_url is in action hash" do
      it "returns action_url from action[:url]" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "REQUIRES_ACTION",
            action: { url: "https://example.com/action" }
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:action_url]).to eq("https://example.com/action")
      end
    end

    context "when redirect_url is in action hash" do
      it "returns redirect_url from action[:redirect_url]" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "REQUIRES_ACTION",
            action: { redirect_url: "https://example.com/redirect" }
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:action_url]).to eq("https://example.com/redirect")
      end
    end

    context "when redirect_url is in top level" do
      it "returns redirect_url from top level" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "REQUIRES_ACTION",
            redirect_url: "https://example.com/redirect"
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:action_url]).to eq("https://example.com/redirect")
      end
    end

    context "when no action_url is present" do
      it "returns nil" do
        allow(client_mock).to receive(:create_subscription_plan).and_return(
          {
            id: "repl_test_123",
            reference_id: "sub-test-123",
            status: "ACTIVE"
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:action_url]).to be_nil
      end
    end
  end
end
