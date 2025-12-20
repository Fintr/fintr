# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::V1::Ai::RagController, type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:organization_space) }
  let(:auth_setup) { setup_authentication(user: user, space: space, auth_id: user.auth_id) }

  before do
    # Mock the controller's set_space method to avoid authentication issues
    allow_any_instance_of(described_class).to receive(:set_space) do |instance|
      instance.instance_variable_set(:@space, space)
    end
    allow_any_instance_of(described_class).to receive(:current_user).and_return(user)
    allow_any_instance_of(described_class).to receive(:current_space).and_return(space)
    allow(space).to receive(:can_ai?).and_return(true)
  end

  describe "POST /api/v1/ai/rag/query" do
    let(:query) { "What are my expenses this month?" }
    let(:valid_params) { { query: query } }
    let(:conversation) { create(:ai_conversation, user: user, space: space) }

    context "with valid parameters" do
      it "returns session_id and processing status" do
        create_usage_operation = instance_double(::Ai::Operations::Usages::CreateUsage)
        allow(::Ai::Operations::Usages::CreateUsage).to receive(:new).and_return(create_usage_operation)
        allow(create_usage_operation).to receive(:call).and_yield.and_return(Dry::Monads::Success(true))

        allow(Ai::AiChatJob).to receive(:perform_later)

        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]

        expect(response).to have_http_status(:ok)

        response_data = JSON.parse(response.body)
        expect(response_data["session_id"]).to be_present
        expect(response_data["status"]).to eq("processing")
        expect(response_data["conversation_id"]).to be_present
      end

      it "starts background processing with Ai::AiChatJob" do
        create_usage_operation = instance_double(::Ai::Operations::Usages::CreateUsage)
        allow(::Ai::Operations::Usages::CreateUsage).to receive(:new).and_return(create_usage_operation)
        allow(create_usage_operation).to receive(:call).and_yield.and_return(Dry::Monads::Success(true))

        expect(Ai::AiChatJob).to receive(:perform_later).with(
          match(/[a-f0-9-]{36}/), # session_id
          query,
          space.id,
          user.id,
          match(/[a-f0-9-]{36}/) # conversation_id
        )

        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]
      end
    end

    context "with existing conversation" do
      let(:conversation_params) { { query: query, conversation_id: conversation.id } }

      before do
        allow(user.conversations).to receive(:find_by).with(id: conversation.id, space_id: space.id).and_return(conversation)
      end

      it "uses existing conversation" do
        create_usage_operation = instance_double(::Ai::Operations::Usages::CreateUsage)
        allow(::Ai::Operations::Usages::CreateUsage).to receive(:new).and_return(create_usage_operation)
        allow(create_usage_operation).to receive(:call).and_yield.and_return(Dry::Monads::Success(true))

        allow(Ai::AiChatJob).to receive(:perform_later)

        expect(conversation).to receive(:add_user_message).with(query)

        post "/api/v1/ai/rag/query",
             params: conversation_params,
             headers: auth_setup[:headers]

        expect(response).to have_http_status(:ok)
        response_data = JSON.parse(response.body)
        expect(response_data["conversation_id"]).to eq(conversation.id)
      end
    end

    context "when conversation creation fails" do
      before do
        create_conversation_operation = instance_double(::Ai::Operations::Conversations::CreateConversation)
        allow(::Ai::Operations::Conversations::CreateConversation).to receive(:new).and_return(create_conversation_operation)
        allow(create_conversation_operation).to receive(:call).and_return(Dry::Monads::Failure("Failed to create conversation"))
      end

      it "returns unprocessable content error" do
        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]

        expect(response).to have_http_status(:unprocessable_content)
        response_data = JSON.parse(response.body)
        expect(response_data["success"]).to be false
        expect(response_data["error"]["message"]).to eq("Failed to create conversation")
      end
    end

    context "with missing query parameter" do
      it "returns unprocessable content error" do
        post "/api/v1/ai/rag/query",
             params: {},
             headers: auth_setup[:headers]

        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context "when space has no available tokens" do
      before do
        allow(space).to receive(:can_ai?).and_return(false)
      end

      it "returns forbidden error with token limit message" do
        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]

        expect(response).to have_http_status(:forbidden)

        response_data = JSON.parse(response.body)
        expect(response_data["success"]).to be false
        expect(response_data["error"]["message"]).to eq("Token limit reached. You have used all available AI tokens for this space.")
      end

      it "does not create a conversation when token limit is reached" do
        expect(::Ai::Operations::Conversations::CreateConversation).not_to receive(:new)

        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]
      end

      it "does not start background processing when token limit is reached" do
        expect(Ai::AiChatJob).not_to receive(:perform_later)

        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]
      end
    end

    context "with invalid space" do
      let(:invalid_headers) do
        auth_setup[:headers].merge("X-Space-Code" => "nonexistent")
      end

      before do
        allow(Rails.cache).to receive(:fetch).with("current_space_nonexistent", expires_in: 15.minutes).and_return(nil)
        allow_any_instance_of(described_class).to receive(:current_space).and_return(nil)
      end

      it "returns forbidden error" do
        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: invalid_headers

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when CreateUsage operation fails" do
      before do
        create_usage_operation = instance_double(::Ai::Operations::Usages::CreateUsage)
        allow(::Ai::Operations::Usages::CreateUsage).to receive(:new).and_return(create_usage_operation)
        allow(create_usage_operation).to receive(:call).and_return(Dry::Monads::Failure("Space token limit reached"))
        allow(Ai::AiChatJob).to receive(:perform_later)
      end

      it "returns success even when usage creation fails" do
        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]

        expect(response).to have_http_status(:ok)

        response_data = JSON.parse(response.body)
        expect(response_data["session_id"]).to be_present
        expect(response_data["status"]).to eq("processing")
        expect(response_data["conversation_id"]).to be_present
      end

      it "does not enqueue the job when usage creation fails" do
        expect(Ai::AiChatJob).not_to receive(:perform_later)

        post "/api/v1/ai/rag/query",
             params: valid_params,
             headers: auth_setup[:headers]
      end
    end
  end

  describe "private methods" do
    let(:controller) { described_class.new }

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
