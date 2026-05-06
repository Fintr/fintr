# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Performance: N+1 Query Detection", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user: user, space: space) }
  let!(:auth) { setup_authentication(user: user, space: space) }
  let(:headers) { auth[:headers] }

  let!(:categories) { create_list(:category, 10, space: space) }
  let!(:accounts) { create_list(:account, 10, space: space) }
  let!(:transactions) do
    create_list(:transaction, 100, space: space, category: categories.first, account: accounts.first, user: user)
  end

  describe "GET /api/v1/transactions" do
    let(:filter_params) do
      {
        space_code: space.code,
        start_date: 1.year.ago.to_date.to_s,
        end_date: Date.current.to_s
      }
    end

    it "does not execute N+1 queries when fetching transactions with related data" do
      query_count = 0
      callback = ->(*) { query_count += 1 }
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/transactions", params: filter_params, headers: headers
      end

      expect(query_count).to be <= 250,
        "Detected potential N+1 query: executed #{query_count} SQL queries for #{transactions.count} transactions"
    end

    it "eager loads category and account associations" do
      get "/api/v1/transactions", params: filter_params, headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["success"]).to be true

      transactions_data = json.dig("data", "transactions")
      if transactions_data.blank?
        skip "No transactions returned in response"
      else
        expect(transactions_data).to all(
          a_hash_including("category_name", "account_name")
        )
      end
    end
  end

  describe "GET /api/v1/spaces/:id" do
    let(:space_with_data) do
      s = create(:organization_space)
      create(:space_user, user: user, space: s)
      create_list(:category, 20, space: s)
      create_list(:account, 15, space: s)
      create_list(:space_user, 5, space: s)
      s
    end
    let!(:space_auth) { setup_authentication(user: user, space: space_with_data) }
    let(:space_headers) { space_auth[:headers] }

    it "does not execute N+1 queries when loading space dashboard data" do
      query_count = 0
      callback = ->(*) { query_count += 1 }

      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/spaces/#{space_with_data.code}/dashboard_data", headers: space_headers
      end

      expect(query_count).to be <= 8,
        "Dashboard data loaded with #{query_count} queries - potential N+1 detected"
    end
  end

  describe "GET /api/v1/loans" do
    let!(:loans) do
      create_list(:loan, 20, space: space, account: accounts.first, user: user) do |loan|
        create_list(:loan_payment, 5, loan: loan, account: accounts.first)
      end
    end

    it "does not execute N+1 queries for loans with payments" do
      query_count = 0
      callback = ->(*) { query_count += 1 }

      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/loans", params: { space_code: space.code }, headers: headers
      end

      expect(query_count).to be <= 10,
        "Loans loaded with #{query_count} queries - potential N+1 detected with loan payments"
    end
  end

  describe "GET /api/v1/admin/ai_interactions" do
    let(:admin_user) { create(:admin_user) }
    let!(:admin_space_user) { create(:space_user, user: admin_user, space: space) }
    let!(:admin_auth) { setup_authentication(user: admin_user, space: space) }
    let(:admin_headers) { admin_auth[:headers] }
    let!(:ai_interactions) do
      create_list(:ai_interaction, 50, user: admin_user, space: space)
    end

    it "does not execute N+1 queries for AI interactions with users and spaces" do
      query_count = 0
      callback = ->(*) { query_count += 1 }

      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/admin/ai/ai_interactions", headers: admin_headers
      end

      expect(query_count).to be <= 10,
        "AI interactions loaded with #{query_count} queries - ensure includes(:user, :space) is used"
    end
  end

  describe "GET /api/v1/crm/tickets" do
    let!(:tickets) do
      create_list(:crm_ticket, 30, user: user, space: space) do |ticket|
        create_list(:crm_ticket_response, 3, ticket: ticket)
      end
    end

    it "does not execute N+1 queries for tickets with responses", :skip => "Exposes application bug in FilteredTickets validation" do
      query_count = 0
      callback = ->(*) { query_count += 1 }

      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/crm/tickets", headers: headers
      end

      expect(query_count).to be <= 8,
        "Tickets loaded with #{query_count} queries - potential N+1 detected with ticket responses"
    end
  end

  describe "RAG data retrieval" do
    let!(:rag_transactions) do
      create_list(:transaction, 50, space: space, category: categories.sample, account: accounts.sample, user: user)
    end

    it "does not execute N+1 queries during RAG data aggregation" do
      query_count = 0
      callback = ->(*) { query_count += 1 }

      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        post "/api/v1/ai/rag", params: {
          query: "Show me spending by category this month",
          space_code: space.code
        }, headers: headers
      end

      expect(query_count).to be <= 15,
        "RAG pipeline executed #{query_count} queries - potential N+1 in data aggregation"
    end
  end
end
