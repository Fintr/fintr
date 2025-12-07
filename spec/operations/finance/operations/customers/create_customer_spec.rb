# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Customers::CreateCustomer, :vcr, type: :operation do
  let(:operation) { described_class.new }
  let(:email) { "test@example.com" }
  let(:given_names) { "John" }
  let(:surname) { "Doe" }
  let(:reference_id) { "cust-b6951e95-964b-4eea-a402-66f060b87e23" }

  let(:valid_params) do
    {
      email:,
      given_names:,
      surname:,
      reference_id:
    }
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with missing email" do
      it "returns failure" do
        params = valid_params.except(:email)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:email)
      end
    end

    context "with optional parameters" do
      it "returns success when only email is provided" do
        params = { email: email }

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with space_id" do
        params = valid_params.merge(space_id: "space-123")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success with metadata" do
        params = valid_params.merge(metadata: { key: "value" })

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    context "with valid parameters" do
      it "creates a Xendit customer successfully", vcr: "xendit/create_customer_operation" do
        result = operation.call(valid_params)

        expect(result).to be_success
        customer_data = result.value!

        expect(customer_data).to be_a(Hash)
        expect(customer_data[:id]).to be_present
        expect(customer_data[:email]).to eq(email)
        expect(customer_data[:individual_detail][:given_names]).to eq(given_names)
        expect(customer_data[:individual_detail][:surname]).to eq(surname)
      end

      it "creates customer with reference_id", vcr: "xendit/create_customer_with_reference_operation" do
        params = valid_params.merge(reference_id: "cust-custom-123")

        result = operation.call(params)

        expect(result).to be_success
        expect(result.value![:reference_id]).to eq("cust-custom-123")
      end

      it "generates reference_id when not provided" do
        params = valid_params.except(:reference_id)
        generated_reference_id = "cust-generated-uuid"

        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(SecureRandom).to receive(:uuid).and_return("generated-uuid")
        allow(client_mock).to receive(:create_customer).and_return(
          {
            id: "cust-123",
            email: email,
            reference_id: generated_reference_id
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        reference_id = result.value![:reference_id]
        expect(reference_id).to be_present
        expect(reference_id).to start_with("cust-")
        expect(client_mock).to have_received(:create_customer) do |args|
          expect(args[:reference_id]).to eq("cust-generated-uuid")
        end
      end

      it "includes space_id in metadata when provided" do
        space_id = "space-123"
        params = valid_params.merge(space_id: space_id)

        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          {
            id: "cust-123",
            email: email,
            reference_id: reference_id
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        expect(client_mock).to have_received(:create_customer) do |args|
          expect(args[:metadata][:space_id]).to eq(space_id)
        end
      end

      it "merges provided metadata with space_id" do
        space_id = "space-123"
        existing_metadata = { existing_key: "existing_value" }
        params = valid_params.merge(space_id: space_id, metadata: existing_metadata)

        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          {
            id: "cust-123",
            email: email,
            reference_id: reference_id
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        expect(client_mock).to have_received(:create_customer) do |args|
          expect(args[:metadata][:space_id]).to eq(space_id)
          expect(args[:metadata][:existing_key]).to eq("existing_value")
        end
      end

      it "creates customer without given_names and surname" do
        params = { email: email }

        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          {
            id: "cust-123",
            email: email,
            reference_id: "cust-generated-uuid"
          }
        )

        result = operation.call(params)

        expect(result).to be_success
        customer_data = result.value!
        expect(customer_data).to be_a(Hash)
        expect(customer_data[:id]).to be_present
        expect(client_mock).to have_received(:create_customer) do |args|
          expect(args[:given_names]).to be_nil
          expect(args[:surname]).to be_nil
        end
      end

      it "includes reference_id in response even if not in Xendit response" do
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer).and_return(
          {
            id: "cust-123",
            email: email
          }
        )

        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:reference_id]).to eq(reference_id)
      end
    end

    context "with invalid parameters" do
      it "returns failure when email is missing" do
        params = valid_params.except(:email)

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:email)
      end

      it "returns failure when email is invalid" do
        params = valid_params.merge(email: "invalid-email")

        result = operation.call(params)

        expect(result).to be_failure
      end
    end

    context "when Xendit API returns an error" do
      it "returns failure with Xendit error details" do
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer)
          .and_raise(Integrations::Payments::Xendit::Error.new(
            message: "Customer already exists",
            status: 422,
            code: "DUPLICATE_CUSTOMER"
          ))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:xendit_error)
        expect(result.failure[:status]).to eq(422)
        expect(result.failure[:code]).to eq("DUPLICATE_CUSTOMER")
      end
    end

    context "when StandardError occurs" do
      it "returns failure with error message" do
        client_mock = instance_double(Integrations::Payments::Xendit::Client)
        allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client_mock)
        allow(client_mock).to receive(:create_customer)
          .and_raise(StandardError.new("Network error"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to create Xendit customer: Network error")
      end
    end
  end
end
