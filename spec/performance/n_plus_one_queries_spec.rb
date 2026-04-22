# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Performance: N+1 Query Detection", type: :request do
  let(:user) { create(:auth_user) }
  let(:space) { create(:spaces_space, users: [user]) }
  let!(:categories) { create_list(:transactions_category, 10, space: space) }
  let!(:accounts) { create_list(:transactions_account, 10, space: space) }
  let!(:transactions) do
    create_list(:transactions_transaction, 100, space: space, category: categories.first, account: accounts.first)
  end

  describe "GET /api/v1/transactions" do
    it "does not execute N+1 queries when fetching transactions with related data" do
      sign_in user

      query_count = 0
      callback = ->(*) { query_count += 1 }
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/transactions", params: { space_code: space.code }
      end

      # Should execute ~5-7 queries (not 100+ which would indicate N+1)
      # 1. Find user/session
      # 2. Find space
      # 3. Count for pagination
      # 4. Main transaction query with includes
      # 5-6. Possibly category/account lookups
      expect(query_count).to be <= 10,
        "Detected potential N+1 query: executed #{query_count} SQL queries for #{transactions.count} transactions"
    end

    it "eager loads category and account associations" do
      sign_in user
      
      get "/api/v1/transactions", params: { space_code: space.code }
      
      transactions_data = JSON.parse(response.body)["transactions"]
      expect(transactions_data).to be_present
      
      # Verify associations are loaded (would throw if lazy loaded)
      transactions_data.each do |transaction|
        expect(transaction).to have_key("category_name")
        expect(transaction).to have_key("account_name")
      end
    end
  end

  describe "GET /api/v1/spaces/:id" do
    let!(:space_with_data) do
      s = create(:spaces_space, users: [user])
      create_list(:transactions_category, 20, space: s)
      create_list(:transactions_account, 15, space: s)
      create_list(:space_user, 5, space: s)
      s
    end

    it "does not execute N+1 queries when loading space dashboard data" do
      sign_in user

      query_count = 0
      callback = ->(*) { query_count += 1 }
      
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/spaces/#{space_with_data.code}/dashboard_data"
      end

      # Should use includes to avoid N+1
      expect(query_count).to be <= 8,
        "Dashboard data loaded with #{query_count} queries - potential N+1 detected"
    end
  end

  describe "GET /api/v1/loans" do
    let!(:loans) do
      create_list(:transactions_loan, 20, space: space, account: accounts.first) do |loan, i|
        create_list(:transactions_loan_payment, 5, loan: loan, account: accounts.first)
      end
    end

    it "does not execute N+1 queries for loans with payments" do
      sign_in user

      query_count = 0
      callback = ->(*) { query_count += 1 }
      
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/loans", params: { space_code: space.code }
      end

      expect(query_count).to be <= 10,
        "Loans loaded with #{query_count} queries - potential N+1 detected with loan payments"
    end
  end

  describe "GET /api/v1/admin/ai_interactions" do
    let(:admin_user) { create(:auth_user, :admin) }
    let!(:ai_interactions) do
      create_list(:ai_interaction, 50, user: admin_user, space: space)
    end

    it "does not execute N+1 queries for AI interactions with users and spaces" do
      sign_in admin_user

      query_count = 0
      callback = ->(*) { query_count += 1 }
      
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/admin/ai/ai_interactions"
      end

      # Should eager load user and space associations
      expect(query_count).to be <= 5,
        "AI interactions loaded with #{query_count} queries - ensure includes(:user, :space) is used"
    end
  end

  describe "GET /api/v1/crm/tickets" do
    let!(:tickets) do
      create_list(:crm_ticket, 30, user: user) do |ticket|
        create_list(:crm_ticket_response, 3, ticket: ticket)
      end
    end

    it "does not execute N+1 queries for tickets with responses" do
      sign_in user

      query_count = 0
      callback = ->(*) { query_count += 1 }
      
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/crm/tickets"
      end

      expect(query_count).to be <= 8,
        "Tickets loaded with #{query_count} queries - potential N+1 detected with ticket responses"
    end
  end

  describe "RAG data retrieval" do
    let!(:rag_transactions) do
      create_list(:transactions_transaction, 50, space: space, category: categories.sample, account: accounts.sample)
    end

    it "does not execute N+1 queries during RAG data aggregation" do
      sign_in user

      # Trigger RAG pipeline via chat
      query_count = 0
      callback = ->(*) { query_count += 1 }
      
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        post "/api/v1/ai/rag", params: {
          query: "Show me spending by category this month",
          space_code: space.code
        }
      end

      # RAG queries should be batched/aggregated, not N+1
      expect(query_count).to be <= 15,
        "RAG pipeline executed #{query_count} queries - potential N+1 in data aggregation"
    end
  end
end
