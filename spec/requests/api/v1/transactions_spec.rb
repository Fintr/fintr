# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Transactions", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user:, space:) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  describe "POST /api/v1/transactions" do
    let(:create_operation) { instance_double(::Transactions::Operations::CreateTransaction) }
    let(:valid_create_params) do
      {
        amount: 100.0,
        date: Date.current.to_s,
        transaction_type: "expense",
        category_name: "Food",
        account_name: "Cash",
        schedule_type: "one_time"
      }
    end

    before do
      allow(::Transactions::Operations::CreateTransaction).to receive(:new).and_return(create_operation)
    end

    context "when the request is successful" do
      let(:created_transaction) { build(:expense_transaction, user:, space:) }

      before do
        allow(create_operation).to receive(:call).and_return(
          Dry::Monads::Result::Success.new(created_transaction)
        )
        post api_v1_transactions_path, params: valid_create_params, headers: headers
      end

      it "returns an HTTP status created" do
        expect(response).to have_http_status(:created)
      end

      it "calls CreateTransaction with params including transaction_type" do
        expect(create_operation).to have_received(:call).with(
          hash_including(transaction_type: "expense")
        ).once
      end

      it "returns success true in the response body" do
        json = JSON.parse(response.body)
        expect(json["success"]).to be true
      end
    end

    context "when the operation fails" do
      before do
        allow(create_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(category_name: "not found")
        )
        post api_v1_transactions_path, params: valid_create_params, headers: headers
      end

      it "returns an HTTP status internal_server_error" do
        expect(response).to have_http_status(:internal_server_error)
      end

      it "returns error details in the response body" do
        json = JSON.parse(response.body)
        expect(json["success"]).to be false
        expect(json["error"]["details"]).to be_present
      end
    end
  end

  describe "PUT /api/v1/transactions/:id" do
    let(:transaction) { create(:expense_transaction, user:, space:) }
    let(:update_operation) { instance_double(::Transactions::Operations::UpdateTransaction) }
    let(:valid_update_params) do
      {
        amount: 150.0,
        date: transaction.date.to_s,
        transaction_type: "expense",
        category_name: "Food",
        account_name: "Cash",
        schedule_type: "one_time"
      }
    end

    before do
      allow(::Transactions::Operations::UpdateTransaction).to receive(:new).and_return(update_operation)
    end

    context "when the request is successful" do
      before do
        allow(update_operation).to receive(:call).and_return(
          Dry::Monads::Result::Success.new(transaction.reload)
        )
        put api_v1_transaction_path(transaction), params: valid_update_params, headers: headers
      end

      it "returns an HTTP status ok" do
        expect(response).to have_http_status(:ok)
      end

      it "calls UpdateTransaction with params including transaction_type" do
        expect(update_operation).to have_received(:call).with(
          hash_including(transaction_type: "expense")
        ).once
      end

      it "returns success true in the response body" do
        json = JSON.parse(response.body)
        expect(json["success"]).to be true
      end
    end

    context "when the operation fails" do
      before do
        allow(update_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(category_name: "not found")
        )
        put api_v1_transaction_path(transaction), params: valid_update_params, headers: headers
      end

      it "returns an HTTP status internal_server_error" do
        expect(response).to have_http_status(:internal_server_error)
      end
    end
  end

  describe "DELETE /api/v1/transactions/:id" do
    let(:transaction) { create(:expense_transaction, user:, space:) }
    let(:delete_operation) { instance_double(::Transactions::Operations::DeleteTransaction) }

    before do
      allow(::Transactions::Operations::DeleteTransaction).to receive(:new).and_return(delete_operation)
    end

    context "when the request is successful" do
      before do
        allow(delete_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(true))
        delete api_v1_transaction_path(transaction), params: { delete_scope: "this_only" }, headers: headers
      end

      it "returns an HTTP status ok" do
        expect(response).to have_http_status(:ok)
      end

      it "calls DeleteTransaction once" do
        expect(delete_operation).to have_received(:call).once
      end
    end

    context "when the operation fails" do
      before do
        allow(delete_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(id: "not found")
        )
        delete api_v1_transaction_path(transaction), params: { delete_scope: "this_only" }, headers: headers
      end

      it "returns an HTTP status internal_server_error" do
        expect(response).to have_http_status(:internal_server_error)
      end
    end
  end

  describe "GET /api/v1/transactions/note_suggestions" do
    let!(:expense_category) { create(:category, name: "Food & Groceries", category_type: "expense", space:) }
    let!(:account) { create(:account, space:) }

    let!(:expense_with_note) do
      create(
        :expense_transaction,
        space:,
        account:,
        category: expense_category,
        description: "Robinsons grocery shopping",
        date: Date.current
      )
    end

    context "when the request is successful" do
      before do
        get note_suggestions_api_v1_transactions_path,
            params: { category_name: "Food & Groceries", transaction_type: "expense" },
            headers: headers
      end

      it "returns an HTTP status ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns success true in the response body" do
        json = JSON.parse(response.body)
        expect(json["success"]).to be true
      end

      it "returns suggestions in the response data" do
        json = JSON.parse(response.body)
        expect(json["data"]["suggestions"]).to be_an(Array)
        expect(json["data"]["suggestions"]).to include("Robinsons grocery shopping")
      end
    end

    context "when category has no notes" do
      let!(:empty_category) { create(:category, name: "Empty Category", category_type: "expense", space:) }

      before do
        get note_suggestions_api_v1_transactions_path,
            params: { category_name: "Empty Category", transaction_type: "expense" },
            headers: headers
      end

      it "returns an HTTP status ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns empty suggestions array" do
        json = JSON.parse(response.body)
        expect(json["data"]["suggestions"]).to eq([])
      end
    end

    context "when category does not exist" do
      before do
        get note_suggestions_api_v1_transactions_path,
            params: { category_name: "Non-existent Category", transaction_type: "expense" },
            headers: headers
      end

      it "returns an HTTP status ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns empty suggestions array" do
        json = JSON.parse(response.body)
        expect(json["data"]["suggestions"]).to eq([])
      end
    end
  end
end
