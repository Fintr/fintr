# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Transactions", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user:, space:) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  describe "GET /api/v1/transactions" do
    let(:account) { create(:account, space: space) }
    let(:income_category) { create(:category, space: space, category_type: "income") }
    let(:expense_category) { create(:category, space: space, category_type: "expense") }

    let(:valid_filter_params) do
      {
        space_code: space.code,
        start_date: Date.new(2024, 1, 1).to_s,
        end_date: Date.new(2024, 1, 31).to_s
      }
    end

    context "when the request is successful" do
      let!(:income_transaction) do
        create(:income_transaction,
               space: space,
               user: user,
               account: account,
               category: income_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 10000)
      end

      let!(:expense_transaction) do
        create(:expense_transaction,
               space: space,
               user: user,
               account: account,
               category: expense_category,
               date: Date.new(2024, 1, 15),
               amount_cents: 5000)
      end

      before do
        get api_v1_transactions_path, params: valid_filter_params, headers: headers
      end

      it "returns an HTTP status ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns success true in the response body" do
        json = JSON.parse(response.body)
        expect(json["success"]).to be true
      end

      it "returns transactions in the response" do
        json = JSON.parse(response.body)
        expect(json["data"]["transactions"]).to be_an(Array)
      end

      it "returns pagination metadata" do
        json = JSON.parse(response.body)
        expect(json["data"]["pagination"]).to include(
          "currentPage",
          "totalPages",
          "totalCount"
        )
      end

      it "returns totals by type" do
        json = JSON.parse(response.body)
        expect(json["data"]["totals"]).to include(
          "income",
          "expense",
          "transfer"
        )
      end

      it "calculates totals correctly" do
        json = JSON.parse(response.body)
        totals = json["data"]["totals"]
        expect(totals["income"].to_f).to eq(100.0)
        expect(totals["expense"].to_f).to eq(50.0)
        expect(totals["transfer"].to_f).to eq(0.0)
      end
    end

    context "when the query fails" do
      before do
        allow(::Transactions::Queries::FilteredCombined).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(space_code: "Not found")
        )
        get api_v1_transactions_path, params: valid_filter_params, headers: headers
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

    context "when totals query fails" do
      let!(:income_transaction) do
        create(:income_transaction,
               space: space,
               user: user,
               account: account,
               category: income_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 10000)
      end

      before do
        allow(::Transactions::Queries::TotalsByType).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(totals: "error")
        )
        get api_v1_transactions_path, params: valid_filter_params, headers: headers
      end

      it "returns an HTTP status ok (graceful degradation)" do
        expect(response).to have_http_status(:ok)
      end

      it "returns default zero totals" do
        json = JSON.parse(response.body)
        totals = json["data"]["totals"]
        expect(totals["income"]).to eq(0.0)
        expect(totals["expense"]).to eq(0.0)
        expect(totals["transfer"]).to eq(0.0)
      end
    end

    context "when paginating USD–USD transfers on a PHP space" do
      let!(:usd_from) do
        create(
          :account,
          space:,
          name: "USD From",
          balance: Money.from_amount(10_000, "USD"),
          balance_currency: "USD"
        )
      end
      let!(:usd_to) do
        create(
          :account,
          space:,
          name: "USD To",
          balance: Money.from_amount(5_000, "USD"),
          balance_currency: "USD"
        )
      end
      let(:fx_date) { Date.new(2024, 1, 1) }

      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 50.0,
          rate_date: fx_date
        )

        27.times do |i|
          create(
            :income_transaction,
            space:,
            user:,
            account: create(:account, space:),
            category: income_category,
            date: Date.new(2024, 1, 27) - i,
            amount_cents: 100
          )
        end

        create(
          :transfer,
          user:,
          space:,
          from_account: usd_from,
          to_account: usd_to,
          date: Date.new(2024, 1, 1),
          amount: Money.from_amount(500, "USD"),
          amount_currency: "USD"
        )
      end

      it "returns converted PHP amount on page 2, not the raw USD numeric as PHP" do
        get api_v1_transactions_path,
            params: valid_filter_params.merge(page: 2, per_page: 25),
            headers: headers

        expect(response).to have_http_status(:ok)

        json = JSON.parse(response.body)
        transfer_row = json["data"]["transactions"].find { |row| row["type"] == "transfer" }

        expect(transfer_row).to be_present
        expect(transfer_row["amount"]).to eq(25_000.0)
        expect(transfer_row["amountCurrency"]).to eq("PHP")
        expect(transfer_row["bookedAmount"]).to eq(500.0)
        expect(transfer_row["bookedAmountCurrency"]).to eq("USD")
      end
    end
  end

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

      context "when category_id and subcategory_id are provided" do
        let(:parent_category) { create(:category, :expense, space:) }
        let(:subcategory) do
          create(:category, :expense, space:, name: "Coffee", parent: parent_category)
        end
        let(:subcategory_create_params) do
          valid_create_params.merge(
            category_id: parent_category.id,
            subcategory_id: subcategory.id,
            category_name: "#{parent_category.id}:#{subcategory.id}"
          )
        end

        before do
          post api_v1_transactions_path, params: subcategory_create_params, headers: headers
        end

        it "forwards category_id to CreateTransaction" do
          expect(create_operation).to have_received(:call).with(
            hash_including(
              category_id: parent_category.id,
              subcategory_id: subcategory.id
            )
          ).once
        end
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

      context "when category_id and subcategory_id are provided" do
        let(:parent_category) { create(:category, :expense, space:) }
        let(:subcategory) do
          create(:category, :expense, space:, name: "Coffee", parent: parent_category)
        end
        let(:subcategory_update_params) do
          valid_update_params.merge(
            category_id: parent_category.id,
            subcategory_id: subcategory.id,
            category_name: "#{parent_category.id}:#{subcategory.id}"
          )
        end

        before do
          put api_v1_transaction_path(transaction),
              params: subcategory_update_params,
              headers: headers
        end

        it "forwards category_id to UpdateTransaction" do
          expect(update_operation).to have_received(:call).with(
            hash_including(
              category_id: parent_category.id,
              subcategory_id: subcategory.id
            )
          ).once
        end
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
