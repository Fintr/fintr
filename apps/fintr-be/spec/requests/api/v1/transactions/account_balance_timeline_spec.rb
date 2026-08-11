# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Account balance timeline", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  let!(:account) do
    create(
      :account,
      space: space,
      name: "Cash",
      balance: Money.from_amount(1_000, "PHP"),
    )
  end

  let!(:income_category) do
    create(:category, space: space, name: "Salary", category_type: "income")
  end

  let!(:expense_category) do
    create(:category, space: space, name: "Food", category_type: "expense")
  end

  let(:date_params) do
    {
      start_date: "1996-01-01",
      end_date: "2099-12-31",
    }
  end

  before do
    income = create(
      :income_transaction,
      user: user,
      space: space,
      account: account,
      category: income_category,
      amount: Money.from_amount(500, "PHP"),
      date: Date.new(2026, 1, 10),
      description: "Paycheck",
    )

    Transactions::Operations::Accounts::CalculateBalance.new.call(transaction_id: income.id)

    expense = create(
      :expense_transaction,
      user: user,
      space: space,
      account: account,
      category: expense_category,
      amount: Money.from_amount(200, "PHP"),
      date: Date.new(2026, 1, 15),
      description: "Groceries",
    )

    Transactions::Operations::Accounts::CalculateBalance.new.call(transaction_id: expense.id)
  end

  describe "GET /api/v1/transactions/accounts/:id/balance_timeline" do
    it "returns balance points ordered by transaction activity" do
      get "/api/v1/transactions/accounts/#{account.id}/balance_timeline",
          params: date_params.merge(space_code: space.code),
          headers: headers

      expect(response).to have_http_status(:ok)

      body = response.parsed_body["data"]
      points = body["points"]
      currency = body["currency"]

      expect(response.parsed_body).to include("success" => true)
      expect(points).to be_present
      expect(currency).to eq("PHP")
      expect(points.last["balance"]).to eq(account.reload.balance.amount.to_f)
    end

    it "returns unprocessable when account is missing" do
      get "/api/v1/transactions/accounts/#{SecureRandom.uuid}/balance_timeline",
          params: date_params.merge(space_code: space.code),
          headers: headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
