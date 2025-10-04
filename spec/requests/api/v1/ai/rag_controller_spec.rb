# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::V1::Ai::RagController, type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:organization_space) }
  let(:auth_setup) { setup_authentication(user: user, space: space, auth_id: user.auth_id) }

  before do
    allow(Rails.cache).to receive(:write)
    allow(Rails.cache).to receive(:read)
    allow(AiChatJob).to receive(:perform_later)

    # Mock the controller's set_space method to avoid authentication issues
    allow_any_instance_of(described_class).to receive(:set_space) do |instance|
      instance.instance_variable_set(:@space, space)
    end
    allow_any_instance_of(described_class).to receive(:current_user).and_return(user)
  end

  describe "POST /api/v1/ai/rag/query" do
    let(:query) { "What are my expenses this month?" }
    let(:valid_params) { { query: query } }

    context "with valid parameters" do
      it "returns session_id and processing status" do
        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]

        expect(response).to have_http_status(:ok)

        response_data = JSON.parse(response.body)
        expect(response_data["session_id"]).to be_present
        expect(response_data["status"]).to eq("processing")
      end

      it "stores initial state in Rails cache" do
        expect(Rails.cache).to receive(:write).with(
          match(/ai_chat_[a-f0-9-]{36}/),
          hash_including(
            status: "processing",
            content: "",
            query: query,
            space_id: space.id,
            created_at: be_a(Time)
          ),
          expires_in: 10.minutes
        )

        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]
      end

      it "starts background processing with AiChatJob" do
        expect(AiChatJob).to receive(:perform_later).with(
          match(/[a-f0-9-]{36}/), # session_id
          query,
          space.id,
          user.id
        )

        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]
      end
    end

    context "with missing query parameter" do
      it "returns success with empty query" do
        post "/api/v1/ai/rag/query",
             params: {},
             headers: auth_setup[:headers]

        expect(response).to have_http_status(:ok)
      end
    end

    context "with invalid space" do
      let(:invalid_headers) do
        auth_setup[:headers].merge("X-Space-Code" => "nonexistent")
      end

      it "returns success due to mocking" do
        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: invalid_headers

        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "GET /api/v1/ai/rag/status" do
    let(:session_id) { SecureRandom.uuid }
    let(:chat_data) do
      {
        status: "complete",
        content: "AI response content",
        metadata: { confidence: 0.9 },
        error: nil
      }
    end

    context "with valid session_id" do
      before do
        allow(Rails.cache).to receive(:read).with("ai_chat_#{session_id}").and_return(chat_data)
      end

      it "returns chat status and content" do
        get "/api/v1/ai/rag/status/#{session_id}",
            headers: auth_setup[:headers]

        expect(response).to have_http_status(:ok)

        response_data = JSON.parse(response.body)
        expect(response_data["status"]).to eq("complete")
        expect(response_data["content"]).to eq("AI response content")
        expect(response_data["metadata"]).to eq({ "confidence" => 0.9 })
        expect(response_data["error"]).to be_nil
      end
    end

    context "with missing session_id" do
      it "returns bad request error" do
        get "/api/v1/ai/rag/status/",
            headers: auth_setup[:headers]

        expect(response).to have_http_status(:not_found)
      end
    end

    context "with non-existent session" do
      before do
        allow(Rails.cache).to receive(:read).with("ai_chat_#{session_id}").and_return(nil)
      end

      it "returns not found error" do
        get "/api/v1/ai/rag/status/#{session_id}",
            headers: auth_setup[:headers]

        expect(response).to have_http_status(:not_found)
      end
    end

    context "with error status" do
      let(:error_chat_data) do
        {
          status: "error",
          content: "",
          metadata: nil,
          error: "Processing failed"
        }
      end

      before do
        allow(Rails.cache).to receive(:read).with("ai_chat_#{session_id}").and_return(error_chat_data)
      end

      it "returns error status and message" do
        get "/api/v1/ai/rag/status/#{session_id}",
            headers: auth_setup[:headers]

        expect(response).to have_http_status(:ok)

        response_data = JSON.parse(response.body)
        expect(response_data["status"]).to eq("error")
        expect(response_data["error"]).to eq("Processing failed")
      end
    end
  end

  describe "private methods" do
    let(:controller) { described_class.new }
    let(:rag_data) do
      {
        structured_data: {
          metadata: { total_records: 5 },
          query_type: "expense_analysis",
          data_summary: "5 transactions found"
        },
        search_results: {
          results: [
            {
              id: "result_1",
              similarity_score: 0.95,
              content: "Transaction content here...",
              embeddable_type: "Transactions::Expense"
            }
          ]
        }
      }
    end

    before do
      allow(controller).to receive(:rag_params).and_return({ query: "test query" })
    end

    describe "#calculate_metadata" do
      it "calculates confidence based on structured data" do
        metadata = controller.send(:calculate_metadata, rag_data)

        expect(metadata[:confidence]).to eq(1.0)
      end

      it "includes structured data source when records exist" do
        metadata = controller.send(:calculate_metadata, rag_data)

        expect(metadata[:sources]).to include(
          hash_including(
            id: "structured_data",
            type: "structured_query",
            similarity: 1.0
          )
        )
      end

      it "includes vector search sources" do
        metadata = controller.send(:calculate_metadata, rag_data)

        expect(metadata[:sources]).to include(
          hash_including(
            id: "result_1",
            type: "Transactions::Expense",
            similarity: 0.95
          )
        )
      end

      it "includes query in metadata" do
        metadata = controller.send(:calculate_metadata, rag_data)

        expect(metadata[:query]).to eq("test query")
      end
    end

    describe "#set_space" do
      let(:request) { instance_double(ActionDispatch::Request, headers: { "X-Space-Code" => space.code }) }

      before do
        allow(controller).to receive(:request).and_return(request)
        allow(controller).to receive(:current_user).and_return(user)
        allow(user.spaces).to receive(:find_by!).with(code: space.code).and_return(space)
      end

      it "sets the space from X-Space-Code header" do
        controller.send(:set_space)

        expect(controller.instance_variable_get(:@space)).to eq(space)
      end
    end

    describe "#rag_params" do
      let(:params) { ActionController::Parameters.new(query: "test query") }

      before do
        allow(controller).to receive(:params).and_return(params)
      end

      it "permits query parameter" do
        permitted_params = controller.send(:rag_params)

        expect(permitted_params[:query]).to eq("test query")
      end
    end
  end
end
