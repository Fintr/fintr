# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "API V1 Transaction Loan Payments", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(10_000, 'PHP'), name: 'Test Account') }
  let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }
  let(:loan) do
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

  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  describe "GET /api/v1/transactions/loans/:loan_id/loan_payments" do
    let!(:loan_payment1) do
      create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 2, 1),
        total_payment_cents: 8_791_59,
        currency: 'PHP'
      )
    end

    let!(:loan_payment2) do
      create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 3, 1),
        total_payment_cents: 8_791_59,
        currency: 'PHP'
      )
    end

    context "when loan exists in current space" do
      it "returns list of loan payments ordered by date desc" do
        get "/api/v1/transactions/loans/#{loan.id}/loan_payments", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("data")
        expect(parsed_response["data"]).to be_an(Array)
        expect(parsed_response["data"].length).to eq(2)

        payment_dates = parsed_response["data"].map { |p| p["date"] }
        expect(payment_dates).to eq([loan_payment2.date.to_s, loan_payment1.date.to_s])
      end
    end

    context "when loan does not exist" do
      it "returns not found error" do
        get "/api/v1/transactions/loans/invalid-id/loan_payments", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context "when loan belongs to different space" do
      let(:other_space) { create(:personal_space) }
      let(:other_loan) { create(:loan, space: other_space, user: user) }

      it "returns not found error" do
        get "/api/v1/transactions/loans/#{other_loan.id}/loan_payments", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "GET /api/v1/transactions/loans/:loan_id/loan_payments/:id" do
    let!(:loan_payment) do
      create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 2, 1),
        total_payment_cents: 8_791_59,
        currency: 'PHP'
      )
    end

    context "when loan payment exists" do
      it "returns the loan payment details" do
        get "/api/v1/transactions/loans/#{loan.id}/loan_payments/#{loan_payment.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("data")
        expect(parsed_response["data"]["id"]).to eq(loan_payment.id.to_s)
        expect(parsed_response["data"]["date"]).to eq(loan_payment.date.to_s)
      end
    end

    context "when loan payment does not exist" do
      it "returns not found error" do
        get "/api/v1/transactions/loans/#{loan.id}/loan_payments/invalid-id", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context "when loan does not exist" do
      it "returns not found error" do
        get "/api/v1/transactions/loans/invalid-id/loan_payments/#{loan_payment.id}", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "POST /api/v1/transactions/loans/:loan_id/loan_payments" do
    let(:operation_double) { instance_double(Transactions::Operations::Loans::CreateLoanPayment) }

    before do
      allow(::Transactions::Operations::Loans::CreateLoanPayment).to receive(:new).and_return(operation_double)
    end

    context "when parameters are valid" do
      let(:valid_params) do
        {
          account_name: account.name,
          date: Date.new(2024, 2, 1).to_s,
          total_payment: 8_791.59,
          notes: "First payment"
        }
      end

      it "creates a new loan payment" do
        loan_payment = build(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 2, 1),
          total_payment_cents: 8_791_59,
          currency: 'PHP'
        )
        operation_result = Dry::Monads::Result::Success.new(loan_payment)

        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/loans/#{loan.id}/loan_payments", params: valid_params, headers: headers

        expect(response).to have_http_status(:created)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
        expect(parsed_response).to include("data")
      end

      it "calls the operation with correct parameters including loan_id" do
        loan_payment = build(:loan_payment, loan: loan, account: account)
        operation_result = Dry::Monads::Result::Success.new(loan_payment)

        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/loans/#{loan.id}/loan_payments", params: valid_params, headers: headers

        expect(operation_double).to have_received(:call).once do |params|
          expect(params[:loan_id]).to eq(loan.id.to_s)
          expect(params[:account_name]).to eq(account.name)
          expect(params[:total_payment].to_f).to eq(8_791.59)
          expect(params[:notes]).to eq("First payment")
        end
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          account_name: "",
          date: Date.new(2024, 2, 1).to_s,
          total_payment: 0
        }
      end

      it "returns validation errors" do
        errors = {
          account_name: ["not found"],
          total_payment: ["must be greater than 0"]
        }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/loans/#{loan.id}/loan_payments", params: invalid_params, headers: headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end

    context "when loan does not exist" do
      it "returns internal server error from operation" do
        errors = { loan_id: ["not found"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/loans/invalid-id/loan_payments", params: { account_name: account.name }, headers: headers

        expect(response).to have_http_status(:internal_server_error)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response["error"]["details"]).to include("loanId")
      end
    end
  end

  describe "PUT /api/v1/transactions/loans/:loan_id/loan_payments/:id" do
    let(:operation_double) { instance_double(Transactions::Operations::Loans::UpdateLoanPayment) }
    let!(:loan_payment) do
      create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 2, 1),
        total_payment_cents: 8_791_59,
        currency: 'PHP'
      )
    end

    before do
      allow(::Transactions::Operations::Loans::UpdateLoanPayment).to receive(:new).and_return(operation_double)
    end

    context "when parameters are valid" do
      let(:valid_params) do
        {
          total_payment: 10_000.00,
          notes: "Updated payment"
        }
      end

      it "updates the loan payment" do
        updated_loan_payment = loan_payment.dup
        updated_loan_payment.total_payment_cents = 10_000_00
        operation_result = Dry::Monads::Result::Success.new(updated_loan_payment)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/#{loan.id}/loan_payments/#{loan_payment.id}", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("data")
      end

      it "calls the operation with correct parameters including loan_payment_id" do
        operation_result = Dry::Monads::Result::Success.new(loan_payment)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/#{loan.id}/loan_payments/#{loan_payment.id}", params: valid_params, headers: headers

        expect(operation_double).to have_received(:call).once do |params|
          expect(params[:loan_payment_id]).to eq(loan_payment.id.to_s)
          expect(params[:total_payment].to_f).to eq(10_000.00)
          expect(params[:notes]).to eq("Updated payment")
        end
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          total_payment: -100
        }
      end

      it "returns validation errors" do
        errors = { total_payment: ["must be greater than 0"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/#{loan.id}/loan_payments/#{loan_payment.id}", params: invalid_params, headers: headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end

    context "when loan payment does not exist" do
      it "returns internal server error from operation" do
        errors = { loan_payment_id: ["not found"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/loans/#{loan.id}/loan_payments/invalid-id", params: { total_payment: 10_000 }, headers: headers

        expect(response).to have_http_status(:internal_server_error)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response["error"]["details"]).to include("loanPaymentId")
      end
    end
  end

  describe "DELETE /api/v1/transactions/loans/:loan_id/loan_payments/:id" do
    let(:operation_double) { instance_double(Transactions::Operations::Loans::DeleteLoanPayment) }
    let!(:loan_payment) do
      create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 2, 1),
        total_payment_cents: 8_791_59,
        currency: 'PHP'
      )
    end

    before do
      allow(::Transactions::Operations::Loans::DeleteLoanPayment).to receive(:new).and_return(operation_double)
    end

    context "when deletion is successful" do
      it "deletes the loan payment" do
        operation_result = Dry::Monads::Result::Success.new(loan_payment)

        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/loans/#{loan.id}/loan_payments/#{loan_payment.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
        expect(parsed_response["message"]).to include("deleted successfully")
      end

      it "calls the operation with correct parameters including loan_payment_id" do
        operation_result = Dry::Monads::Result::Success.new(loan_payment)

        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/loans/#{loan.id}/loan_payments/#{loan_payment.id}", headers: headers

        expect(operation_double).to have_received(:call).once do |params|
          expect(params[:loan_payment_id]).to eq(loan_payment.id.to_s)
        end
      end
    end

    context "when operation fails" do
      it "returns internal server error" do
        errors = { loan_payment_id: ["not found"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/loans/#{loan.id}/loan_payments/#{loan_payment.id}", headers: headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end

    context "when loan payment does not exist" do
      it "returns internal server error from operation" do
        errors = { loan_payment_id: ["not found"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/loans/#{loan.id}/loan_payments/invalid-id", headers: headers

        expect(response).to have_http_status(:internal_server_error)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response["error"]["details"]).to include("loanPaymentId")
      end
    end
  end
end
