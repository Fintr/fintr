# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "API V1 Transaction Accounts", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  before do
    # Override the ::Transactions namespace to prevent collision
    allow(::Transactions::Operations::Accounts::CreateAccount).to receive(:new) do
      operation_double
    end
  end

  describe "POST /api/v1/transactions/accounts" do
    let(:operation_double) { instance_double(Transactions::Operations::Accounts::CreateAccount) }

    context "when parameters are valid" do
      let(:valid_params) do
        {
          name: "Savings Account",
          balance: 500.00
        }
      end

      it "creates a new account" do
        # Mock the operation result
        account = build(:account, name: "Savings Account", balance: Money.from_amount(500.00, "PHP"))
        operation_result = Dry::Monads::Result::Success.new(account)

        # Setup the mock to respond to call
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts", params: valid_params, headers: headers

        # Check response
        expect(response).to have_http_status(:created)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          name: "",
          balance: -100.00
        }
      end

      it "returns validation errors" do
        # Mock operation failure result
        errors = {
          name: ["can't be blank"],
          balance: ["must be a positive number"]
        }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        # Setup the mock to respond to call
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts", params: invalid_params, headers: headers

        # Check response
        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end

    context "when account name already exists" do
      let(:duplicate_params) do
        {
          name: "Existing Account",
          balance: 200.00
        }
      end

      it "returns uniqueness validation error" do
        # Mock operation failure result for duplicate name
        errors = { name: ["has already been taken"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        # Setup the mock to respond to call
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts", params: duplicate_params, headers: headers

        # Check response
        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("name")
        expect(parsed_response["error"]["details"]["name"]).to include("has already been taken")
      end
    end
  end
end
