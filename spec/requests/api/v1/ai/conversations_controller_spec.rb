# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::V1::Ai::ConversationsController, type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:organization_space) }
  let(:auth_setup) { setup_authentication(user: user, space: space, auth_id: user.auth_id) }

  before do
    # Create space user association for authentication
    create(:space_user, user: user, space: space)
  end

  describe "GET /api/v1/ai/conversations" do
    let!(:conversation1) { create(:ai_conversation, user: user, space: space, title: "First Conversation") }
    let!(:conversation2) { create(:ai_conversation, user: user, space: space, title: "Second Conversation") }
    let!(:other_user_conversation) { create(:ai_conversation, title: "Other User Conversation") }

    it "returns user's conversations for the space" do
      get "/api/v1/ai/conversations",
          headers: auth_setup[:headers]

      expect(response).to have_http_status(:ok)

      response_data = JSON.parse(response.body)
      expect(response_data["success"]).to be true
      expect(response_data["data"]).to be_an(Array)
      expect(response_data["data"].length).to eq(2)
    end

    it "includes conversation details in the response" do
      get "/api/v1/ai/conversations",
          headers: auth_setup[:headers]

      response_data = JSON.parse(response.body)
      conversation_data = response_data["data"].first

      expect(conversation_data).to include(
        "id",
        "title",
        "lastMessageAt",
        "createdAt",
        "updatedAt",
        "messageCount"
      )
    end

    it "returns conversations ordered by most recent" do
      # Update the second conversation to be more recent
      conversation2.update!(last_message_at: 1.hour.ago)
      conversation1.update!(last_message_at: 2.hours.ago)

      get "/api/v1/ai/conversations",
          headers: auth_setup[:headers]

      response_data = JSON.parse(response.body)
      expect(response_data["data"].first["id"]).to eq(conversation2.id.to_s)
    end

    it "limits results to 50 conversations" do
      # Create 51 conversations
      51.times do |i|
        create(:ai_conversation, user: user, space: space, title: "Conversation #{i}")
      end

      get "/api/v1/ai/conversations",
          headers: auth_setup[:headers]

      response_data = JSON.parse(response.body)
      expect(response_data["data"].length).to eq(50)
    end
  end

  describe "GET /api/v1/ai/conversations/:id" do
    let!(:conversation) { create(:ai_conversation, user: user, space: space, title: "Test Conversation") }
    let!(:message1) { create(:ai_conversation_message, conversation: conversation, content: "Hello") }
    let!(:message2) { create(:ai_conversation_message, conversation: conversation, content: "Hi there") }

    it "returns the conversation with messages" do
      get "/api/v1/ai/conversations/#{conversation.id}",
          headers: auth_setup[:headers]

      expect(response).to have_http_status(:ok)

      response_data = JSON.parse(response.body)
      expect(response_data["success"]).to be true
      expect(response_data["data"]["id"]).to eq(conversation.id.to_s)
      expect(response_data["data"]["title"]).to eq("Test Conversation")
    end

    it "includes messages in chronological order" do
      get "/api/v1/ai/conversations/#{conversation.id}",
          headers: auth_setup[:headers]

      response_data = JSON.parse(response.body)
      messages = response_data["data"]["messages"]

      expect(messages).to be_an(Array)
      expect(messages.length).to eq(2)
      expect(messages.first["content"]).to eq("Hello")
      expect(messages.last["content"]).to eq("Hi there")
    end

    it "returns 404 for non-existent conversation" do
      get "/api/v1/ai/conversations/999999",
          headers: auth_setup[:headers]

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 for conversation belonging to different user" do
      other_conversation = create(:ai_conversation, title: "Other User's Conversation")

      get "/api/v1/ai/conversations/#{other_conversation.id}",
          headers: auth_setup[:headers]

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/ai/conversations" do
    let(:valid_params) { { title: "New Conversation" } }
    let(:create_operation) { instance_double(::Ai::Operations::Conversations::CreateConversation) }
    let(:created_conversation) { create(:ai_conversation, user: user, space: space, title: "New Conversation") }

    before do
      allow(::Ai::Operations::Conversations::CreateConversation).to receive(:new).and_return(create_operation)
    end

    it "creates a new conversation with valid parameters" do
      allow(create_operation).to receive(:call).and_return(Dry::Monads::Success(created_conversation))

      post "/api/v1/ai/conversations",
           params: valid_params,
           headers: auth_setup[:headers]

      expect(response).to have_http_status(:created)

      response_data = JSON.parse(response.body)
      expect(response_data["success"]).to be true
      expect(response_data["data"]["id"]).to eq(created_conversation.id.to_s)
    end

    it "calls the CreateConversation operation with correct parameters" do
      expected_params = hash_including(
        user_id: user.id.to_s,
        space_id: space.id.to_s,
        title: "New Conversation"
      )

      allow(create_operation).to receive(:call).with(expected_params).and_return(Dry::Monads::Success(created_conversation))

      post "/api/v1/ai/conversations",
           params: valid_params,
           headers: auth_setup[:headers]

      expect(create_operation).to have_received(:call).with(expected_params)
    end

    it "uses default title when no title is provided" do
      allow(create_operation).to receive(:call).and_return(Dry::Monads::Success(created_conversation))

      post "/api/v1/ai/conversations",
           params: {},
           headers: auth_setup[:headers]

      expect(response).to have_http_status(:created)
    end

    it "returns error when operation fails" do
      failure_details = { "base" => ["Failed to create conversation"] }
      allow(create_operation).to receive(:call).and_return(Dry::Monads::Failure(failure_details))

      post "/api/v1/ai/conversations",
           params: valid_params,
           headers: auth_setup[:headers]

      expect(response).to have_http_status(:unprocessable_content)

      response_data = JSON.parse(response.body)
      expect(response_data["success"]).to be false
      expect(response_data["error"]["message"]).to eq("Failed to create conversation")
      expect(response_data["error"]["details"]).to eq(failure_details)
    end
  end

  describe "PUT /api/v1/ai/conversations/:id" do
    let!(:conversation) { create(:ai_conversation, user: user, space: space, title: "Original Title") }
    let(:update_params) { { title: "Updated Title" } }

    it "updates the conversation with valid parameters" do
      put "/api/v1/ai/conversations/#{conversation.id}",
          params: update_params,
          headers: auth_setup[:headers]

      expect(response).to have_http_status(:ok)

      response_data = JSON.parse(response.body)
      expect(response_data["id"]).to eq(conversation.id.to_s)
      expect(response_data["title"]).to eq("Updated Title")
    end

    it "returns error when update fails" do
      allow_any_instance_of(Ai::Conversation).to receive(:update).and_return(false)
      allow_any_instance_of(Ai::Conversation).to receive(:errors).and_return(
        instance_double(ActiveModel::Errors, full_messages: ["Title cannot be blank"])
      )

      put "/api/v1/ai/conversations/#{conversation.id}",
          params: { title: "" },
          headers: auth_setup[:headers]

      expect(response).to have_http_status(:unprocessable_content)

      response_data = JSON.parse(response.body)
      expect(response_data["success"]).to be false
      expect(response_data["error"]["message"]).to eq("Failed to update conversation")
      expect(response_data["error"]["details"]).to eq(["Title cannot be blank"])
    end

    it "returns 404 for non-existent conversation" do
      put "/api/v1/ai/conversations/999999",
          params: update_params,
          headers: auth_setup[:headers]

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 for conversation belonging to different user" do
      other_conversation = create(:ai_conversation, title: "Other User's Conversation")

      put "/api/v1/ai/conversations/#{other_conversation.id}",
          params: update_params,
          headers: auth_setup[:headers]

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/ai/conversations/:id" do
    let!(:conversation) { create(:ai_conversation, user: user, space: space, title: "To Be Deleted") }
    let(:delete_operation) { instance_double(::Ai::Operations::Conversations::DeleteConversation) }

    before do
      allow(::Ai::Operations::Conversations::DeleteConversation).to receive(:new).and_return(delete_operation)
    end

    it "deletes the conversation successfully" do
      allow(delete_operation).to receive(:call).and_return(Dry::Monads::Success(conversation))

      delete "/api/v1/ai/conversations/#{conversation.id}",
             headers: auth_setup[:headers]

      expect(response).to have_http_status(:ok)

      response_data = JSON.parse(response.body)
      expect(response_data["success"]).to be true
      expect(response_data["message"]).to eq("Conversation deleted successfully")
    end

    it "calls the DeleteConversation operation with correct parameters" do
      expected_params = hash_including(
        conversation_id: conversation.id.to_s,
        user_id: user.id.to_s,
        space_id: space.id.to_s
      )

      allow(delete_operation).to receive(:call).with(expected_params).and_return(Dry::Monads::Success(conversation))

      delete "/api/v1/ai/conversations/#{conversation.id}",
             headers: auth_setup[:headers]

      expect(delete_operation).to have_received(:call).with(expected_params)
    end

    it "returns error when operation fails" do
      failure_details = { "conversation_not_found" => "Conversation not found" }
      allow(delete_operation).to receive(:call).and_return(Dry::Monads::Failure(failure_details))

      delete "/api/v1/ai/conversations/#{conversation.id}",
             headers: auth_setup[:headers]

      expect(response).to have_http_status(:unprocessable_content)

      response_data = JSON.parse(response.body)
      expect(response_data["success"]).to be false
      expect(response_data["error"]["details"]).to eq({ "conversationNotFound" => "Conversation not found" })
    end

    it "returns 404 for non-existent conversation" do
      allow(delete_operation).to receive(:call).and_return(Dry::Monads::Failure({ "conversation_not_found" => "Conversation not found" }))

      delete "/api/v1/ai/conversations/999999",
             headers: auth_setup[:headers]

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "returns 404 for conversation belonging to different user" do
      other_conversation = create(:ai_conversation, title: "Other User's Conversation")
      allow(delete_operation).to receive(:call).and_return(Dry::Monads::Failure({ "conversation_not_found" => "Conversation not found" }))

      delete "/api/v1/ai/conversations/#{other_conversation.id}",
             headers: auth_setup[:headers]

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "private methods" do
    let(:controller) { described_class.new }

    describe "#conversation_params" do
      let(:params) { ActionController::Parameters.new(title: "Test Title", invalid_param: "value") }

      before do
        allow(controller).to receive(:params).and_return(params)
      end

      it "permits only the title parameter" do
        permitted_params = controller.send(:conversation_params)

        expect(permitted_params[:title]).to eq("Test Title")
        expect(permitted_params[:invalid_param]).to be_nil
      end
    end
  end
end
