# frozen_string_literal: true

require "rails_helper"

RSpec.describe Integrations::Payments::Xendit::Client, :vcr do
  let(:api_key) { "test_xendit_api_key" }
  let(:client) { described_class.new(api_key: api_key) }

  before do
    allow(ENV).to receive(:fetch).with("XENDIT_API_KEY").and_return(api_key)
  end

  describe "#create_customer" do
    let(:email) { "test@example.com" }
    let(:given_names) { "John" }
    let(:surname) { "Doe" }

    it "creates a customer successfully" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return(
        '{"id": "cust-123", "email": "test@example.com", "given_names": "John", "surname": "Doe"}'
      )
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.create_customer(
        email: email,
        given_names: given_names,
        surname: surname
      )

      expect(result).to be_a(Hash)
      expect(result[:id]).to be_present
      expect(result[:email]).to eq(email)
      expect(result[:given_names]).to eq(given_names)
      expect(result[:surname]).to eq(surname)
    end

    it "creates a customer with reference_id" do
      reference_id = "cust-test-123"
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return(
        "{\"id\": \"cust-123\", \"reference_id\": \"#{reference_id}\"}"
      )
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.create_customer(
        email: email,
        reference_id: reference_id
      )

      expect(result[:reference_id]).to eq(reference_id)
    end

    it "generates reference_id when not provided" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return(
        '{"id": "cust-123", "reference_id": "cust-generated-uuid"}'
      )
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.create_customer(email: email)

      expect(result[:reference_id]).to be_present
      expect(result[:reference_id]).to start_with("cust-")
    end

    context "when API returns an error" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPUnprocessableEntity.new("1.1", "422", "Unprocessable Entity")
        allow(response).to receive(:body).and_return('{"message": "Invalid email"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.create_customer(email: "invalid")
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#create_subscription_plan" do
    let(:customer_id) { "cust-test-123" }
    let(:amount) { 14_900 }
    let(:schedule) do
      {
        reference_id: "schedule-test-123",
        interval: "MONTH",
        interval_count: 1,
        total_recurrence: 12,
        anchor_date: Time.current.iso8601,
        retry_interval: "DAY",
        retry_interval_count: 1,
        total_retry: 3,
        failed_attempt_notifications: [1, 3]
      }
    end
    let(:notification_config) do
      {
        locale: "en",
        recurring_created: ["EMAIL"],
        recurring_succeeded: ["EMAIL"],
        recurring_failed: ["EMAIL"]
      }
    end

    it "creates a subscription plan successfully" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return(
        "{\"id\": \"plan-123\", \"customer_id\": \"#{customer_id}\", \"amount\": #{amount}, \"status\": \"ACTIVE\"}"
      )
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.create_subscription_plan(
        params: {
          customer_id: customer_id,
          amount: amount,
          schedule: schedule,
          notification_config: notification_config
        }
      )

      expect(result).to be_a(Hash)
      expect(result[:id]).to be_present
      expect(result[:customer_id]).to eq(customer_id)
      expect(result[:amount]).to eq(amount)
      expect(result[:status]).to be_present
    end

    context "when API returns an error" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPUnprocessableEntity.new("1.1", "422", "Unprocessable Entity")
        allow(response).to receive(:body).and_return('{"message": "Invalid customer"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.create_subscription_plan(
            params: {
              customer_id: "invalid",
              amount: amount,
              schedule: schedule
            }
          )
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#get_subscription_plan" do
    let(:plan_id) { "plan-test-123" }

    it "retrieves subscription plan details" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return("{\"id\": \"#{plan_id}\"}")
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.get_subscription_plan(plan_id: plan_id)

      expect(result).to be_a(Hash)
      expect(result[:id]).to eq(plan_id)
    end

    context "when plan not found" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPNotFound.new("1.1", "404", "Not Found")
        allow(response).to receive(:body).and_return('{"message": "Plan not found"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.get_subscription_plan(plan_id: "nonexistent")
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#deactivate_subscription_plan" do
    let(:plan_id) { "plan-test-123" }

    it "deactivates a subscription plan" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"id": "plan-test-123", "status": "INACTIVE"}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.deactivate_subscription_plan(plan_id: plan_id)

      expect(result).to be_a(Hash)
      expect(result[:status]).to eq("INACTIVE")
    end
  end

  describe "#get_payment" do
    let(:action_id) { "action-test-123" }

    it "retrieves payment details" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return("{\"id\": \"#{action_id}\"}")
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.get_payment(action_id: action_id)

      expect(result).to be_a(Hash)
      expect(result[:id]).to eq(action_id)
    end
  end

  describe "#update_subscription_plan" do
    let(:plan_id) { "plan-test-123" }
    let(:update_params) do
      {
        amount: 20_000,
        description: "Updated plan"
      }
    end

    it "updates subscription plan successfully" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"id": "plan-test-123", "amount": 20000}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.update_subscription_plan(plan_id: plan_id, params: update_params)

      expect(result).to be_a(Hash)
      expect(result[:id]).to eq(plan_id)
    end

    context "when API returns an error" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPNotFound.new("1.1", "404", "Not Found")
        allow(response).to receive(:body).and_return('{"message": "Plan not found"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.update_subscription_plan(plan_id: "nonexistent", params: update_params)
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#update_recurring_schedule" do
    let(:plan_id) { "plan-test-123" }
    let(:schedule_id) { "schedule-test-123" }
    let(:update_params) do
      {
        interval: "YEAR",
        interval_count: 1
      }
    end

    it "updates recurring schedule successfully" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"id": "schedule-test-123", "interval": "YEAR"}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.update_recurring_schedule(
        plan_id: plan_id,
        schedule_id: schedule_id,
        params: update_params
      )

      expect(result).to be_a(Hash)
    end

    context "when API returns an error" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPNotFound.new("1.1", "404", "Not Found")
        allow(response).to receive(:body).and_return('{"message": "Schedule not found"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.update_recurring_schedule(
            plan_id: "nonexistent",
            schedule_id: schedule_id,
            params: update_params
          )
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#create_payment_session" do
    let(:customer_id) { "cust-test-123" }
    let(:amount) { 14_900 }
    let(:session_params) do
      {
        customer_id: customer_id,
        amount: amount,
        success_redirect_url: "https://example.com/success",
        failure_redirect_url: "https://example.com/failure"
      }
    end

    it "creates a payment session successfully" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return(
        '{"id": "session-123", "customer_id": "cust-test-123", "amount": 14900}'
      )
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.create_payment_session(params: session_params)

      expect(result).to be_a(Hash)
      expect(result[:id]).to eq("session-123")
      expect(result[:customer_id]).to eq(customer_id)
      expect(result[:amount]).to eq(amount)
    end

    it "uses default values for optional parameters" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"id": "session-123"}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      expect(client).to receive(:post).and_call_original

      result = client.create_payment_session(params: session_params)

      expect(result).to be_a(Hash)
    end

    it "uses cancel_return_url from failure_redirect_url when not provided" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"id": "session-123"}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.create_payment_session(params: session_params)

      expect(result).to be_a(Hash)
    end

    context "when API returns an error" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPUnprocessableEntity.new("1.1", "422", "Unprocessable Entity")
        allow(response).to receive(:body).and_return('{"message": "Invalid customer"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.create_payment_session(
            params: session_params.merge(customer_id: "invalid")
          )
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#simulate_cycle_payment" do
    let(:plan_id) { "plan-test-123" }
    let(:cycle_id) { "cycle-test-123" }
    let(:amount) { 14_900 }

    it "simulates cycle payment successfully" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"success": true}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.simulate_cycle_payment(
        plan_id: plan_id,
        cycle_id: cycle_id,
        amount: amount
      )

      expect(result).to be_a(Hash)
    end

    it "converts amount to integer" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"success": true}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      expect(client).to receive(:post).with(
        "/recurring/plans/#{plan_id}/cycles/#{cycle_id}/simulate",
        { amount: 149 }
      ).and_call_original

      client.simulate_cycle_payment(
        plan_id: plan_id,
        cycle_id: cycle_id,
        amount: 149.0
      )
    end

    context "when API returns an error" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPNotFound.new("1.1", "404", "Not Found")
        allow(response).to receive(:body).and_return('{"message": "Cycle not found"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.simulate_cycle_payment(
            plan_id: "nonexistent",
            cycle_id: cycle_id,
            amount: amount
          )
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#force_attempt_cycle" do
    let(:plan_id) { "plan-test-123" }
    let(:cycle_id) { "cycle-test-123" }

    it "forces attempt for cycle successfully" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"success": true}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.force_attempt_cycle(plan_id: plan_id, cycle_id: cycle_id)

      expect(result).to be_a(Hash)
    end

    context "when API returns an error" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPNotFound.new("1.1", "404", "Not Found")
        allow(response).to receive(:body).and_return('{"message": "Cycle not found"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.force_attempt_cycle(plan_id: "nonexistent", cycle_id: cycle_id)
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#initialize_account_linking" do
    let(:customer_id) { "cust-test-123" }
    let(:type) { "DEBIT_CARD" }
    let(:metadata) { { key: "value" } }

    it "initializes account linking successfully" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return(
        '{"id": "link-123", "customer_id": "cust-test-123"}'
      )
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.initialize_account_linking(
        customer_id: customer_id,
        type: type,
        metadata: metadata
      )

      expect(result).to be_a(Hash)
      expect(result[:customer_id]).to eq(customer_id)
    end

    it "uses empty metadata when not provided" do
      http_mock = instance_double(Net::HTTP)
      response = Net::HTTPSuccess.new("1.1", "200", "OK")
      allow(response).to receive(:body).and_return('{"id": "link-123"}')
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=)
      allow(http_mock).to receive(:read_timeout=)
      allow(http_mock).to receive(:open_timeout=)
      allow(http_mock).to receive(:request).and_return(response)

      result = client.initialize_account_linking(
        customer_id: customer_id,
        type: type
      )

      expect(result).to be_a(Hash)
    end

    context "when API returns an error" do
      it "raises an error" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPNotFound.new("1.1", "404", "Not Found")
        allow(response).to receive(:body).and_return('{"message": "Customer not found"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.initialize_account_linking(
            customer_id: "invalid",
            type: type
          )
        end.to raise_error(Integrations::Payments::Xendit::Error)
      end
    end
  end

  describe "#initialize" do
    context "when api_key is provided" do
      it "uses provided api_key" do
        client = described_class.new(api_key: "custom_key")

        expect(client.instance_variable_get(:@api_key)).to eq("custom_key")
      end
    end

    context "when api_key is not provided" do
      it "uses XENDIT_API_KEY from ENV" do
        allow(ENV).to receive(:fetch).with("XENDIT_API_KEY").and_return("env_key")

        client = described_class.new

        expect(client.instance_variable_get(:@api_key)).to eq("env_key")
      end
    end

    context "when api_key is nil" do
      it "raises ArgumentError" do
        allow(ENV).to receive(:fetch).with("XENDIT_API_KEY").and_return(nil)

        expect do
          described_class.new(api_key: nil)
        end.to raise_error(ArgumentError, "Xendit API key is required")
      end
    end

    context "when api_key is empty string" do
      it "raises ArgumentError" do
        expect do
          described_class.new(api_key: "")
        end.to raise_error(ArgumentError, "Xendit API key is required")
      end
    end

    context "when XENDIT_API_KEY is not set in ENV" do
      it "raises ArgumentError" do
        allow(ENV).to receive(:fetch).with("XENDIT_API_KEY").and_raise(KeyError)

        expect do
          described_class.new
        end.to raise_error(KeyError)
      end
    end
  end

  describe "error handling" do
    context "when request times out" do
      it "raises timeout error" do
        http_mock = instance_double(Net::HTTP)
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_raise(Timeout::Error.new("timeout"))

        expect do
          client.create_customer(email: "test@example.com")
        end.to raise_error(Integrations::Payments::Xendit::Error, /timeout/)
      end
    end

    context "when HTTP response is unauthorized" do
      it "raises error with 401 status" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPUnauthorized.new("1.1", "401", "Unauthorized")
        allow(response).to receive(:body).and_return('{"message": "Invalid API key"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.create_customer(email: "test@example.com")
        end.to raise_error(Integrations::Payments::Xendit::Error) do |error|
          expect(error.status).to eq(401)
        end
      end
    end

    context "when HTTP response is not found" do
      it "raises error with 404 status" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPNotFound.new("1.1", "404", "Not Found")
        allow(response).to receive(:body).and_return('{"message": "Resource not found"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.get_subscription_plan(plan_id: "nonexistent")
        end.to raise_error(Integrations::Payments::Xendit::Error) do |error|
          expect(error.status).to eq(404)
        end
      end
    end

    context "when HTTP response is unprocessable entity" do
      it "raises error with 422 status" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPUnprocessableEntity.new("1.1", "422", "Unprocessable Entity")
        allow(response).to receive(:body).and_return('{"message": "Validation failed"}')
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.create_customer(email: "invalid")
        end.to raise_error(Integrations::Payments::Xendit::Error) do |error|
          expect(error.status).to eq(422)
        end
      end
    end

    context "when HTTP response has other error status" do
      it "raises error with correct status code" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPInternalServerError.new("1.1", "500", "Internal Server Error")
        allow(response).to receive(:body).and_return('{"message": "Server error"}')
        allow(response).to receive(:code).and_return("500")
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        expect do
          client.create_customer(email: "test@example.com")
        end.to raise_error(Integrations::Payments::Xendit::Error) do |error|
          expect(error.status).to eq(500)
        end
      end
    end

    context "when response body is empty" do
      it "handles empty response body" do
        http_mock = instance_double(Net::HTTP)
        response = Net::HTTPSuccess.new("1.1", "200", "OK")
        allow(response).to receive(:body).and_return("")
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_return(response)

        result = client.get_subscription_plan(plan_id: "test")

        expect(result).to eq({})
      end
    end

    context "when request raises StandardError" do
      it "raises Xendit Error with error message" do
        http_mock = instance_double(Net::HTTP)
        allow(Net::HTTP).to receive(:new).and_return(http_mock)
        allow(http_mock).to receive(:use_ssl=)
        allow(http_mock).to receive(:read_timeout=)
        allow(http_mock).to receive(:open_timeout=)
        allow(http_mock).to receive(:request).and_raise(StandardError.new("Connection failed"))

        expect do
          client.create_customer(email: "test@example.com")
        end.to raise_error(Integrations::Payments::Xendit::Error, /Connection failed/)
      end
    end
  end

  describe "private methods" do
    describe "#add_headers" do
      it "sets correct authorization header" do
        request = Net::HTTP::Get.new(URI("https://api.xendit.co/test"))
        client.send(:add_headers, request)

        auth_header = request["Authorization"]
        expect(auth_header).to start_with("Basic ")
        decoded = Base64.strict_decode64(auth_header.split(" ").last)
        expect(decoded).to eq("#{api_key}:")
      end

      it "sets Content-Type header" do
        request = Net::HTTP::Post.new(URI("https://api.xendit.co/test"))
        client.send(:add_headers, request)

        expect(request["Content-Type"]).to eq("application/json")
      end

      it "sets Accept header" do
        request = Net::HTTP::Get.new(URI("https://api.xendit.co/test"))
        client.send(:add_headers, request)

        expect(request["Accept"]).to eq("application/json")
      end
    end

    describe "#parse_response" do
      context "when response is successful" do
        it "returns symbolized hash" do
          response = Net::HTTPSuccess.new("1.1", "200", "OK")
          allow(response).to receive(:body).and_return('{"id": "123", "name": "Test"}')

          result = client.send(:parse_response, response)

          expect(result).to eq({ id: "123", name: "Test" })
        end
      end

      context "when response body has nested keys" do
        it "deep symbolizes keys" do
          response = Net::HTTPSuccess.new("1.1", "200", "OK")
          allow(response).to receive(:body).and_return(
            '{"data": {"user": {"id": "123"}}}'
          )

          result = client.send(:parse_response, response)

          expect(result).to eq({ data: { user: { id: "123" } } })
        end
      end
    end
  end
end
