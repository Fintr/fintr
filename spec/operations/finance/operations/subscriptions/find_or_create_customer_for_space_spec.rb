# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::FindOrCreateCustomerForSpace, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user, email: "owner@example.com", full_name: "John Doe") }
  let(:space) { create(:space) }
  let(:valid_params) do
    {
      space_id: space.id.to_s
    }
  end

  before do
    create(:space_user, space: space, user: user)
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
        # Pass nil for space_id to test missing required parameter
        result = operation.validate(params: { space_id: nil })

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end
    end

    context "with optional fields" do
      it "returns success when email is present" do
        params = valid_params.merge(email: "test@example.com")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when email is nil" do
        params = valid_params.merge(email: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when given_names is present" do
        params = valid_params.merge(given_names: "John")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when given_names is nil" do
        params = valid_params.merge(given_names: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when surname is present" do
        params = valid_params.merge(surname: "Doe")

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when surname is nil" do
        params = valid_params.merge(surname: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    context "when space already has a customer" do
      before do
        space.update!(
          xendit_customer_id: "cust-existing-123",
          xendit_customer_reference_id: "ref-existing-456"
        )
      end

      it "returns success" do
        result = operation.call(valid_params)

        expect(result).to be_success
      end

      it "returns existing customer id" do
        result = operation.call(valid_params)

        customer_data = result.value!
        expect(customer_data[:id]).to eq("cust-existing-123")
      end

      it "returns existing customer reference_id" do
        result = operation.call(valid_params)

        customer_data = result.value!
        expect(customer_data[:reference_id]).to eq("ref-existing-456")
      end
    end

    context "when space does not have a customer" do
      let(:create_customer_operation) do
        instance_double(Finance::Operations::Customers::CreateCustomer)
      end
      let(:customer_data) do
        {
          id: "cust-new-123",
          reference_id: "ref-new-456",
          email: user.email,
          given_names: "John",
          surname: "Doe"
        }
      end

      before do
        allow(Finance::Operations::Customers::CreateCustomer).to receive(:new)
          .and_return(create_customer_operation)
        allow(create_customer_operation).to receive(:call)
          .and_return(Dry::Monads::Success(customer_data))
      end

      it "creates a new customer successfully" do
        result = operation.call(valid_params)

        expect(result).to be_success
      end

      it "returns customer data as a hash" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to be_a(Hash)
      end

      it "returns customer data with id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        customer_data_result = result.value!
        expect(customer_data_result[:id]).to eq("cust-new-123")
      end

      it "returns customer data with reference_id" do
        result = operation.call(valid_params)

        expect(result).to be_success
        customer_data_result = result.value!
        expect(customer_data_result[:reference_id]).to eq("ref-new-456")
      end

      it "stores customer id on space" do
        operation.call(valid_params)

        space.reload
        expect(space.xendit_customer_id).to eq("cust-new-123")
      end

      it "stores customer reference_id on space" do
        operation.call(valid_params)

        space.reload
        expect(space.xendit_customer_reference_id).to eq("ref-new-456")
      end

      it "calls CreateCustomer with space owner's email" do
        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:email]).to eq(user.email)
          Dry::Monads::Success(customer_data)
        end

        operation.call(valid_params)
      end

      it "calls CreateCustomer with space owner's given_names" do
        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:given_names]).to eq("John")
          Dry::Monads::Success(customer_data)
        end

        operation.call(valid_params)
      end

      it "calls CreateCustomer with space owner's surname" do
        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:surname]).to eq("Doe")
          Dry::Monads::Success(customer_data)
        end

        operation.call(valid_params)
      end

      it "calls CreateCustomer with space_id" do
        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:space_id]).to eq(space.id.to_s)
          Dry::Monads::Success(customer_data)
        end

        operation.call(valid_params)
      end

      it "calls CreateCustomer with reference_id containing space id" do
        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:reference_id]).to start_with("space-#{space.id}-")
          Dry::Monads::Success(customer_data)
        end

        operation.call(valid_params)
      end
    end

    context "with custom parameters" do
      let(:create_customer_operation) do
        instance_double(Finance::Operations::Customers::CreateCustomer)
      end
      let(:customer_data) do
        {
          id: "cust-custom-123",
          reference_id: "ref-custom-456"
        }
      end

      before do
        allow(Finance::Operations::Customers::CreateCustomer).to receive(:new)
          .and_return(create_customer_operation)
        allow(create_customer_operation).to receive(:call)
          .and_return(Dry::Monads::Success(customer_data))
      end

      it "uses provided email instead of owner's email" do
        params = valid_params.merge(email: "custom@example.com")

        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:email]).to eq("custom@example.com")
          Dry::Monads::Success(customer_data)
        end

        operation.call(params)
      end

      it "uses provided given_names instead of owner's name" do
        params = valid_params.merge(given_names: "Jane")

        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:given_names]).to eq("Jane")
          Dry::Monads::Success(customer_data)
        end

        operation.call(params)
      end

      it "uses provided surname instead of owner's surname" do
        params = valid_params.merge(surname: "Smith")

        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:surname]).to eq("Smith")
          Dry::Monads::Success(customer_data)
        end

        operation.call(params)
      end
    end

    context "when space has no users" do
      let(:space_without_users) { create(:space) }
      let(:create_customer_operation) do
        instance_double(Finance::Operations::Customers::CreateCustomer)
      end
      let(:customer_data) do
        {
          id: "cust-fallback-123",
          reference_id: "ref-fallback-456"
        }
      end

      before do
        allow(Finance::Operations::Customers::CreateCustomer).to receive(:new)
          .and_return(create_customer_operation)
        allow(create_customer_operation).to receive(:call)
          .and_return(Dry::Monads::Success(customer_data))
      end

      it "uses fallback email when space has no users" do
        params = { space_id: space_without_users.id.to_s }

        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:email]).to eq("space-#{space_without_users.id}@fintr.app")
          Dry::Monads::Success(customer_data)
        end

        operation.call(params)
      end

      it "uses fallback given_names when space has no users" do
        params = { space_id: space_without_users.id.to_s }

        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:given_names]).to eq("Space")
          Dry::Monads::Success(customer_data)
        end

        operation.call(params)
      end

      it "uses fallback surname when space has no users" do
        params = { space_id: space_without_users.id.to_s }

        expect(create_customer_operation).to receive(:call) do |args|
          expect(args[:surname]).to eq("Owner")
          Dry::Monads::Success(customer_data)
        end

        operation.call(params)
      end
    end

    context "when space is not found" do
      it "returns failure" do
        params = { space_id: "99999999-9999-9999-9999-999999999999" }

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end
    end

    context "with invalid parameters" do
      it "returns failure when space_id is missing" do
        # Pass nil for space_id to test missing required parameter
        result = operation.call(space_id: nil)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end
    end

    context "when CreateCustomer operation fails" do
      it "returns failure when CreateCustomer fails" do
        create_customer_mock = instance_double(Finance::Operations::Customers::CreateCustomer)
        allow(Finance::Operations::Customers::CreateCustomer).to receive(:new).and_return(create_customer_mock)
        allow(create_customer_mock).to receive(:call).and_return(
          Failure(xendit_error: "API error", status: 422)
        )

        result = operation.call(valid_params)

        expect(result).to be_failure
      end

      it "propagates xendit_error from CreateCustomer failure" do
        create_customer_mock = instance_double(Finance::Operations::Customers::CreateCustomer)
        allow(Finance::Operations::Customers::CreateCustomer).to receive(:new).and_return(create_customer_mock)
        allow(create_customer_mock).to receive(:call).and_return(
          Failure(xendit_error: "API error", status: 422)
        )

        result = operation.call(valid_params)

        expect(result.failure).to have_key(:xendit_error)
      end

      it "propagates status from CreateCustomer failure" do
        create_customer_mock = instance_double(Finance::Operations::Customers::CreateCustomer)
        allow(Finance::Operations::Customers::CreateCustomer).to receive(:new).and_return(create_customer_mock)
        allow(create_customer_mock).to receive(:call).and_return(
          Failure(xendit_error: "API error", status: 422)
        )

        result = operation.call(valid_params)

        expect(result.failure[:status]).to eq(422)
      end
    end
  end
end
