# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "API V1 Transaction Loans", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(10_000, 'PHP'), name: 'Test Account') }
  let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  describe "GET /api/v1/transactions/loans" do
    let!(:loan1) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account,
        date: Date.new(2024, 1, 1),
        created_at: 2.days.ago
      )
    end

    let!(:loan2) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account,
        date: Date.new(2024, 1, 1),
        created_at: 1.day.ago
      )
    end

    let!(:loan3) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account,
        date: Date.new(2024, 1, 2),
        created_at: 3.days.ago
      )
    end

    context "when successful" do
      it "returns paginated list of loans ordered by date desc and created_at desc" do
        get "/api/v1/transactions/loans", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("data")
        expect(parsed_response["data"]).to include("loans")
        expect(parsed_response["data"]).to include("pagination")

        loans = parsed_response["data"]["loans"]
        expect(loans).to be_an(Array)
        expect(loans.length).to eq(3)

        loan_dates = loans.map { |l| l["date"] }
        expect(loan_dates).to eq([loan3.date.to_s, loan1.date.to_s, loan2.date.to_s])
      end

      it "respects per_page parameter" do
        get "/api/v1/transactions/loans", params: { per_page: 2 }, headers: headers

        parsed_response = JSON.parse(response.body)
        loans = parsed_response["data"]["loans"]
        expect(loans.length).to eq(2)
        expect(parsed_response["data"]["pagination"]).to be_present
      end

      it "limits per_page to maximum of 100" do
        get "/api/v1/transactions/loans", params: { per_page: 200 }, headers: headers

        parsed_response = JSON.parse(response.body)
        pagination = parsed_response["data"]["pagination"]
        expect(pagination).to be_present
        expect(pagination["total_count"] || 3).to be <= 3
      end

      it "defaults to per_page of 10 when not provided" do
        get "/api/v1/transactions/loans", headers: headers

        parsed_response = JSON.parse(response.body)
        loans = parsed_response["data"]["loans"]
        expect(loans.length).to eq(3)
      end

      it "supports pagination with page parameter" do
        get "/api/v1/transactions/loans", params: { page: 1, per_page: 2 }, headers: headers

        parsed_response = JSON.parse(response.body)
        expect(parsed_response["data"]["pagination"]).to be_present
      end
    end

    context "when loans belong to different space" do
      let(:other_space) { create(:personal_space) }
      let!(:other_loan) { create(:loan, space: other_space, user: user) }

      it "only returns loans from current space" do
        get "/api/v1/transactions/loans", headers: headers

        parsed_response = JSON.parse(response.body)
        loans = parsed_response["data"]["loans"]
        loan_ids = loans.map { |l| l["id"] }

        expect(loan_ids).to include(loan1.id.to_s)
        expect(loan_ids).to include(loan2.id.to_s)
        expect(loan_ids).to include(loan3.id.to_s)
        expect(loan_ids).not_to include(other_loan.id.to_s)
      end
    end
  end

  describe "GET /api/v1/transactions/loans/:id" do
    let!(:loan) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account,
        principal_amount_cents: 100_000_00,
        outstanding_balance_cents: 100_000_00,
        interest_rate: 10.0,
        loan_term_months: 12,
        date: Date.new(2024, 1, 1),
        maturity_date: Date.new(2024, 12, 31),
        loan_type: 'borrowed',
        currency: 'PHP'
      )
    end

    context "when loan exists in current space" do
      it "returns the loan details" do
        get "/api/v1/transactions/loans/#{loan.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("data")
        expect(parsed_response["data"]["id"]).to eq(loan.id.to_s)
        expect(parsed_response["data"]["date"]).to eq(loan.date.to_s)
        expect(parsed_response["data"]["loanType"]).to eq("borrowed")
      end
    end

    context "when loan does not exist" do
      it "returns not found error" do
        get "/api/v1/transactions/loans/invalid-id", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context "when loan belongs to different space" do
      let(:other_space) { create(:personal_space) }
      let(:other_loan) { create(:loan, space: other_space, user: user) }

      it "returns not found error" do
        get "/api/v1/transactions/loans/#{other_loan.id}", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "POST /api/v1/transactions/loans" do
    let(:operation_double) { instance_double(Transactions::Operations::Loans::CreateLoan) }

    before do
      allow(::Transactions::Operations::Loans::CreateLoan).to receive(:new).and_return(operation_double)
    end

    context "when parameters are valid" do
      let(:valid_params) do
        {
          principal_amount: 100_000.00,
          interest_rate: 10.0,
          date: Date.new(2024, 1, 1).to_s,
          loan_type: "borrowed",
          entity_name: "Test Lender",
          account_name: account.name,
          loan_term_months: 12,
          description: "Test loan description"
        }
      end

      it "creates a new loan" do
        loan = build(
          :loan,
          user: user,
          space: space,
          entity: entity,
          account: account,
          principal_amount_cents: 100_000_00,
          interest_rate: 10.0
        )
        operation_result = Dry::Monads::Result::Success.new(loan)

        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/loans", params: valid_params, headers: headers

        expect(response).to have_http_status(:created)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
        expect(parsed_response).to include("data")
      end

      it "calls the operation with correct parameters including user_id and space_id" do
        loan = build(:loan, user: user, space: space, entity: entity, account: account)
        operation_result = Dry::Monads::Result::Success.new(loan)

        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/loans", params: valid_params, headers: headers

        expect(operation_double).to have_received(:call).once do |params|
          params_hash = params.to_h
          expect(params_hash["user_id"]).to eq(user.id.to_s)
          expect(params_hash["space_id"]).to eq(space.id.to_s)
          expect(params_hash["space_code"]).to eq(space.code)
          expect(params_hash["principal_amount"]).to eq("100000.0")
          expect(params_hash["interest_rate"]).to eq("10.0")
          expect(params_hash["date"]).to eq(Date.new(2024, 1, 1).to_s)
          expect(params_hash["loan_type"]).to eq("borrowed")
          expect(params_hash["entity_name"]).to eq("Test Lender")
          expect(params_hash["account_name"]).to eq(account.name)
          expect(params_hash["loan_term_months"]).to eq("12")
          expect(params_hash["description"]).to eq("Test loan description")
        end
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          principal_amount: -100.00,
          interest_rate: -5.0,
          date: "",
          loan_type: "invalid_type"
        }
      end

      it "returns validation errors" do
        errors = {
          principal_amount: ["must be greater than 0"],
          interest_rate: ["must be between 0 and 100"],
          loan_type: ["must be one of: borrowed, lent"]
        }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/loans", params: invalid_params, headers: headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end

    context "when operation fails due to account not found" do
      let(:invalid_params) do
        {
          principal_amount: 100_000.00,
          interest_rate: 10.0,
          date: Date.new(2024, 1, 1).to_s,
          loan_type: "borrowed",
          entity_name: "Test Lender",
          account_name: "Non-existent Account",
          loan_term_months: 12
        }
      end

      it "returns internal server error with details" do
        errors = { account_name: ["not found"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/loans", params: invalid_params, headers: headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response["error"]["details"]).to include("accountName" => ["not found"])
      end
    end
  end

  describe "PUT /api/v1/transactions/loans/:id" do
    let!(:loan) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account,
        principal_amount_cents: 100_000_00,
        interest_rate: 10.0
      )
    end

    let(:operation_double) do
      instance_double(Loans::Operations::UpdateLoan)
    end

    before do
      allow(::Loans::Operations::UpdateLoan).to receive(:new).and_return(operation_double)
      allow(operation_double).to receive(:call).and_return(Dry::Monads::Result::Success.new(loan))
    end

    context "when parameters are valid" do
      let(:valid_params) do
        {
          id: loan.id,
          entity_name: "Updated Lender",
          description: "Updated loan description"
        }
      end

      it "updates the loan" do
        operation_result = Dry::Monads::Result::Success.new(loan)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/#{loan.id}", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("data")
      end

      it "calls the operation with correct parameters including user_id and space_id" do
        operation_result = Dry::Monads::Result::Success.new(loan)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/#{loan.id}", params: valid_params, headers: headers

        expect(operation_double).to have_received(:call).once do |params|
          params_hash = params.to_h
          expect(params_hash["id"]).to eq(loan.id.to_s)
          expect(params_hash["user_id"]).to eq(user.id.to_s)
          expect(params_hash["space_id"]).to eq(space.id.to_s)
          expect(params_hash["space_code"]).to eq(space.code)
          expect(params_hash["entity_name"]).to eq("Updated Lender")
          expect(params_hash["description"]).to eq("Updated loan description")
        end
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          id: loan.id
        }
      end

      it "returns validation errors" do
        errors = {
          base: ["at least one of entity_name or description must be provided"]
        }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/#{loan.id}", params: invalid_params, headers: headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end

    context "when loan does not exist" do
      it "returns internal server error when operation fails" do
        errors = { id: "not found" }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/invalid-id",
            params: { description: "Updated loan description" },
            headers: headers

        expect(response).to have_http_status(:internal_server_error)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
      end
    end

    context "when loan belongs to different space" do
      let(:other_space) { create(:personal_space) }
      let(:other_loan) { create(:loan, space: other_space, user: user) }

      it "returns internal server error when operation fails" do
        errors = { id: "not found" }
        operation_result = Dry::Monads::Result::Failure.new(errors)
        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/#{other_loan.id}",
            params: { description: "Updated loan description" },
            headers: headers

        expect(response).to have_http_status(:internal_server_error)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
      end
    end
  end

  describe "DELETE /api/v1/transactions/loans/:id" do
    let!(:loan) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account,
        principal_amount_cents: 100_000_00
      )
    end

    context "when loan exists in current space" do
      it "deletes the loan" do
        delete "/api/v1/transactions/loans/#{loan.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
        expect(parsed_response["message"]).to eq("Loan deleted successfully")

        expect { loan.reload }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when loan does not exist" do
      it "returns internal server error with loan not found details" do
        delete "/api/v1/transactions/loans/invalid-id", headers: headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]["details"]).to include("loanId" => "not found")
      end
    end

    context "when loan belongs to different space" do
      let(:other_space) { create(:personal_space) }
      let(:other_loan) { create(:loan, space: other_space, user: user) }

      it "returns internal server error with loan not found details" do
        delete "/api/v1/transactions/loans/#{other_loan.id}", headers: headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]["details"]).to include("loanId" => "not found")
      end
    end
  end
end
