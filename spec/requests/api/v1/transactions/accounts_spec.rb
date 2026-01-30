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
        expect(response).to have_http_status(:unprocessable_content)
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
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("name")
        expect(parsed_response["error"]["details"]["name"]).to include("has already been taken")
      end
    end
  end

  describe "PUT /api/v1/transactions/accounts/:id" do
    let(:operation_double) { instance_double(Transactions::Operations::Accounts::UpdateAccount) }
    let!(:account_to_update) { create(:account, space: space, name: "Original Account Name") }

    before do
      allow(::Transactions::Operations::Accounts::UpdateAccount).to receive(:new).and_return(operation_double)
    end

    context "when parameters are valid" do
      let(:valid_params) do
        {
          id: account_to_update.id,
          name: "Updated Account Name"
        }
      end

      it "updates the account" do
        updated_account = build(:account, name: "Updated Account Name")
        operation_result = Dry::Monads::Result::Success.new(updated_account)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/accounts/#{account_to_update.id}", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
        expect(parsed_response["data"]["id"]).to eq(updated_account.id)
        expect(parsed_response["data"]["name"]).to eq(updated_account.name)
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          id: account_to_update.id,
          name: ""
        }
      end

      it "returns validation errors" do
        errors = { name: ["can't be blank"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/accounts/#{account_to_update.id}", params: invalid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end
  end

  describe "GET /api/v1/transactions/accounts" do
    let(:operation_double) { instance_double(Transactions::Operations::Accounts::ShowAccounts) }

    before do
      allow(::Transactions::Operations::Accounts::ShowAccounts).to receive(:new).and_return(operation_double)
    end

    context "when successful" do
      let(:mock_accounts_data) { [{ "id" => "1", "name" => "Cash", "balance" => "1000.00" }] }

      it "returns a list of accounts" do
        operation_result = Dry::Monads::Result::Success.new(
          accounts: mock_accounts_data,
          accountCategoryOptions: [
            { "label" => "Cash", "value" => "cash" },
            { "label" => "Savings", "value" => "savings" },
            { "label" => "Debit Card", "value" => "debit" },
            { "label" => "Credit Card", "value" => "credit_card" },
            { "label" => "E-Wallet", "value" => "e_wallet" },
            { "label" => "Loan", "value" => "loan" },
            { "label" => "Investment", "value" => "investment" }
          ]
        )
        allow(operation_double).to receive(:call).and_return(operation_result)

        get "/api/v1/transactions/accounts", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("data")
        expect(parsed_response["data"]).to include("accounts" => mock_accounts_data)
        expect(parsed_response["data"]).to include("accountCategoryOptions")
      end
    end

    context "when operation fails" do
      it "returns an unprocessable entity error" do
        errors = { space_id: ["is invalid"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        get "/api/v1/transactions/accounts", headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]["details"]).to eq("spaceId" => ["is invalid"])
      end
    end
  end

  describe "DELETE /api/v1/transactions/accounts/:id" do
    let(:operation_double) { instance_double(Transactions::Operations::Accounts::DeleteAccount) }
    let!(:account_to_delete) { create(:account, space: space, name: "Account to Delete") }

    before do
      allow(::Transactions::Operations::Accounts::DeleteAccount).to receive(:new).and_return(operation_double)
    end

    context "when deletion is successful" do
      it "discards the account" do
        operation_result = Dry::Monads::Result::Success.new(account_to_delete)
        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/accounts/#{account_to_delete.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
      end
    end

    context "when account has transactions" do
      let!(:account_with_transactions) { create(:account, space: space, name: "Account With Transactions") }
      let!(:transaction) { create(:transaction, account: account_with_transactions, space: space) }

      it "returns an unprocessable entity error" do
        errors = { account: ["has transactions"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/accounts/#{account_with_transactions.id}", headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("account" => ["has transactions"])
      end
    end

    context "when account is not found" do
      it "returns a not found error" do
        errors = { account: ["not found"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/accounts/invalid-id", headers: headers

        expect(response).to have_http_status(:unprocessable_content) # Changed to unprocessable_content
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("account" => ["not found"])
      end
    end

    context "when space_id is missing or invalid in params" do
      it "returns an unprocessable entity error" do
        errors = { space_id: ["is missing"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/accounts/#{account_to_delete.id}", headers: headers, params: { id: account_to_delete.id }

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("spaceId" => ["is missing"])
      end
    end
  end

  describe "POST /api/v1/transactions/accounts/:id/adjust_balance" do
    let(:operation_double) { instance_double(Transactions::Operations::Accounts::AdjustAccountBalance) }
    let!(:account_to_adjust) { create(:account, space: space, name: "Account to Adjust", balance: Money.from_amount(1000, 'PHP')) }

    before do
      allow(::Transactions::Operations::Accounts::AdjustAccountBalance).to receive(:new).and_return(operation_double)
    end

    context "when adjustment is successful with positive balance change" do
      let(:valid_params) do
        {
          id: account_to_adjust.id,
          new_balance: 1500.0,
          adjustment_date: Date.current.to_s
        }
      end

      it "adjusts the account balance" do
        adjustment_transaction = build(:income_transaction, amount: Money.from_amount(500.0, 'PHP'), description: 'Balance adjustment')
        operation_result = Dry::Monads::Result::Success.new(adjustment_transaction)
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts/#{account_to_adjust.id}/adjust_balance", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
        expect(parsed_response).to include("data")
      end
    end

    context "when adjustment is successful with negative balance change" do
      let(:valid_params) do
        {
          id: account_to_adjust.id,
          new_balance: 700.0,
          adjustment_date: Date.current.to_s
        }
      end

      it "adjusts the account balance downward" do
        adjustment_transaction = build(:expense_transaction, amount: Money.from_amount(300.0, 'PHP'), description: 'Balance adjustment')
        operation_result = Dry::Monads::Result::Success.new(adjustment_transaction)
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts/#{account_to_adjust.id}/adjust_balance", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          id: account_to_adjust.id,
          new_balance: 1500.0
        }
      end

      it "returns validation errors" do
        errors = { adjustment_date: ["is missing"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts/#{account_to_adjust.id}/adjust_balance", params: invalid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end

    context "when adjustment_date has invalid format" do
      let(:invalid_date_params) do
        {
          id: account_to_adjust.id,
          new_balance: 1500.0,
          adjustment_date: 'invalid-date'
        }
      end

      it "returns date format error" do
        errors = { adjustment_date: "invalid date format" }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts/#{account_to_adjust.id}/adjust_balance", params: invalid_date_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("adjustmentDate" => "invalid date format")
      end
    end

    context "when account is not found" do
      let(:params_with_invalid_account) do
        {
          id: 'non-existent-id',
          new_balance: 1500.0,
          adjustment_date: Date.current.to_s
        }
      end

      it "returns account not found error" do
        errors = { account: "not found" }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts/non-existent-id/adjust_balance", params: params_with_invalid_account, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("account" => "not found")
      end
    end

    context "when transaction creation fails" do
      let(:valid_params) do
        {
          id: account_to_adjust.id,
          new_balance: 1500.0,
          adjustment_date: Date.current.to_s
        }
      end

      it "returns transaction creation error" do
        errors = { transaction: "could not create adjustment transaction", error: { category_name: "not found" } }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/accounts/#{account_to_adjust.id}/adjust_balance", params: valid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("transaction" => "could not create adjustment transaction")
      end
    end
  end
end
