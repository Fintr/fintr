# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Account-scoped loan activity", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  let!(:account) do
    create(
      :account,
      space: space,
      name: "Cash",
      balance: Money.from_amount(1_000, "PHP")
    )
  end

  let!(:entity) do
    Entities::Entity.find_or_create_by!(
      space: space,
      entity_type: "loan",
      full_name: "BDO"
    )
  end

  let!(:loan) do
    Transactions::Loan.create!(
      user: user,
      space: space,
      entity: entity,
      account: account,
      principal_amount_cents: 200_000_00,
      outstanding_balance_cents: 200_000_00,
      currency: "PHP",
      interest_rate: 0,
      date: Date.new(2026, 6, 18),
      loan_type: "borrowed",
      loan_term_months: 12,
      maturity_date: Date.new(2027, 6, 18),
      status: "active",
      description: "Borrow from BDO",
      adjusts_account_balance: true
    )
  end

  let(:date_params) do
    {
      start_date: "1996-01-01",
      end_date: "2026-12-31",
      page: 1
    }
  end

  describe "GET /api/v1/transactions" do
    it "includes loan disbursement when filtering by account_id" do
      get "/api/v1/transactions",
          params: date_params.merge(
            space_code: space.code,
            account_id: account.id
          ),
          headers: headers

      expect(response).to have_http_status(:ok)

      types = response.parsed_body.dig("data", "transactions").map { |row| row["type"] }
      expect(types).to include("loan_disbursement")
    end

    it "includes loan disbursement when filtering by account_name" do
      get "/api/v1/transactions",
          params: date_params.merge(
            space_code: space.code,
            account_name: account.name
          ),
          headers: headers

      expect(response).to have_http_status(:ok)

      types = response.parsed_body.dig("data", "transactions").map { |row| row["type"] }
      expect(types).to include("loan_disbursement")
    end
  end

  describe "GET /api/v1/transactions/accounts/:id/activities" do
    it "includes loan disbursement for the account" do
      get "/api/v1/transactions/accounts/#{account.id}/activities",
          params: date_params,
          headers: headers

      expect(response).to have_http_status(:ok)

      kinds = response.parsed_body.dig("data", "activities").map { |row| row["type"] }
      expect(kinds).to include("loan_disbursement")
    end
  end
end
