# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Performance: Large Dataset Handling", type: :request do
  let(:user) { create(:auth_user) }
  let(:space) { create(:spaces_space, users: [user]) }

  describe "GET /api/v1/transactions with large datasets" do
    before do
      categories = create_list(:transactions_category, 5, space: space)
      accounts = create_list(:transactions_account, 5, space: space)
      
      # Create 10,000 transactions to test pagination
      100.times do
        create_list(
          :transactions_transaction,
          100,
          space: space,
          category: categories.sample,
          account: accounts.sample
        )
      end
    end

    it "returns paginated results within acceptable time" do
      sign_in user

      start_time = Time.current
      
      get "/api/v1/transactions", params: { 
        space_code: space.code,
        page: 1,
        per_page: 25
      }
      
      end_time = Time.current
      duration = end_time - start_time

      expect(response).to have_http_status(:success)
      expect(duration).to be < 1.0,
        "Transaction list took #{duration}s to load - should be under 1 second with proper pagination"
      
      json = JSON.parse(response.body)
      expect(json["transactions"].length).to eq(25)
      expect(json["pagination"]["total_count"]).to eq(10000)
    end

    it "does not load all records into memory at once" do
      sign_in user

      # Monitor memory usage
      initial_memory = GC.stat(:total_allocated_objects)
      
      get "/api/v1/transactions", params: { 
        space_code: space.code,
        page: 1,
        per_page: 25
      }
      
      final_memory = GC.stat(:total_allocated_objects)
      allocated = final_memory - initial_memory

      expect(allocated).to be < 100_000,
        "Query allocated #{allocated} objects - ensure pagination is using lazy loading (find_each)"
    end

    it "handles CSV generation with streaming for large datasets" do
      sign_in user

      start_time = Time.current
      
      get "/api/v1/transactions/generate_csv", params: { 
        space_code: space.code
      }
      
      end_time = Time.current
      duration = end_time - start_time

      expect(response).to have_http_status(:success)
      expect(response.content_type).to eq("text/csv")
      
      # CSV generation should use streaming, not load all into memory
      expect(duration).to be < 10.0,
        "CSV generation took #{duration}s for 10,000 records - should use find_each/streaming"
    end
  end

  describe "GET /api/v1/loans with amortization schedules" do
    before do
      account = create(:transactions_account, space: space)
      
      # Create loans with large amortization schedules
      create_list(:transactions_loan, 50, space: space, account: account) do |loan|
        loan.update!(term_months: 360) # 30-year loan = 360 payments
      end
    end

    it "computes amortization schedules efficiently" do
      sign_in user

      start_time = Time.current
      
      get "/api/v1/loans", params: { space_code: space.code }
      
      end_time = Time.current
      duration = end_time - start_time

      expect(response).to have_http_status(:success)
      expect(duration).to be < 5.0,
        "Loan list with amortization schedules took #{duration}s - consider caching or lazy computation"
    end
  end

  describe "GET /api/v1/admin/users" do
    let(:admin_user) { create(:auth_user, :admin) }
    
    before do
      # Create 5,000 users
      create_list(:auth_user, 5000)
    end

    it "paginates large user lists efficiently" do
      sign_in admin_user

      start_time = Time.current
      
      get "/api/v1/admin/users", params: { page: 1 }
      
      end_time = Time.current
      duration = end_time - start_time

      expect(response).to have_http_status(:success)
      expect(duration).to be < 1.0,
        "User list took #{duration}s to load - should be under 1 second with pagination"
    end
  end

  describe "AI Chat with large conversation history" do
    let(:conversation) { create(:ai_conversation, user: user, space: space) }
    
    before do
      # Create conversation with 500 messages
      create_list(:ai_conversation_message, 500, conversation: conversation)
    end

    it "retrieves conversation history without loading all messages" do
      sign_in user

      start_time = Time.current
      
      get "/api/v1/ai/conversations/#{conversation.id}/messages"
      
      end_time = Time.current
      duration = end_time - start_time

      expect(response).to have_http_status(:success)
      expect(duration).to be < 2.0,
        "Conversation messages took #{duration}s - should paginate large conversations"
    end
  end

  describe "Bulk import operations" do
    let(:import_file) do
      # Simulate a CSV with 1000 rows
      rows = 1000.times.map do |i|
        "#{i + 1},2024-01-15,Expense,Test Category,Test Account,100.00,Test Description"
      end
      "Date,Type,Category,Account,Amount,Description\n" + rows.join("\n")
    end

    it "processes bulk imports in batches" do
      sign_in user

      # Upload import file
      post "/api/v1/imports", params: {
        space_code: space.code,
        file: fixture_file_upload(StringIO.new(import_file), "text/csv")
      }

      expect(response).to have_http_status(:created)
      
      import = Imports::Import.last
      
      # Process import
      start_time = Time.current
      
      post "/api/v1/imports/#{import.id}/process"
      
      end_time = Time.current
      duration = end_time - start_time

      expect(response).to have_http_status(:success)
      expect(duration).to be < 30.0,
        "Bulk import of 1000 records took #{duration}s - should use find_each for batch processing"
    end
  end
end
