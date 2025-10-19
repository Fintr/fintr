# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Conversations::DeleteConversation, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:conversation) { create(:ai_conversation, user:, space:) }
  let(:conversation_id) { conversation.id.to_s }
  let(:user_id) { user.id.to_s }
  let(:space_id) { space.id.to_s }

  let(:params) do
    {
      conversation_id:,
      user_id:,
      space_id:
    }
  end

  describe "Contract" do
    it "succeeds with valid parameters" do
      result = operation.validate(params:)
      expect(result).to be_success
      expect(result.value!).to eq(params)
    end

    it "fails without conversation_id" do
      params_without_conversation_id = params.except(:conversation_id)
      result = operation.validate(params: params_without_conversation_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:conversation_id)
    end

    it "fails without user_id" do
      params_without_user_id = params.except(:user_id)
      result = operation.validate(params: params_without_user_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:user_id)
    end

    it "fails without space_id" do
      params_without_space_id = params.except(:space_id)
      result = operation.validate(params: params_without_space_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails with invalid conversation_id type" do
      params_with_invalid_conversation_id = params.merge(conversation_id: 123)
      result = operation.validate(params: params_with_invalid_conversation_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:conversation_id)
    end

    it "fails with invalid user_id type" do
      params_with_invalid_user_id = params.merge(user_id: 123)
      result = operation.validate(params: params_with_invalid_user_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:user_id)
    end

    it "fails with invalid space_id type" do
      params_with_invalid_space_id = params.merge(space_id: 123)
      result = operation.validate(params: params_with_invalid_space_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end
  end

  describe "#call" do
    context "when conversation exists and belongs to user and space" do
      it "successfully deletes the conversation" do
        # Create the conversation first
        conversation
        expect { operation.call(params) }.to change(Ai::Conversation, :count).by(-1)
      end

      it "returns the deleted conversation" do
        # Create the conversation first
        conversation
        result = operation.call(params)
        expect(result).to be_success
        expect(result.value!).to eq(conversation)
      end

      it "finds conversation with correct parameters" do
        # Create the conversation first
        conversation
        allow(Ai::Conversation).to receive(:find_by).with(
          user_id:,
          space_id:,
          id: conversation_id
        ).and_return(conversation)

        result = operation.call(params)
        expect(result).to be_success
      end
    end

    context "when conversation does not exist" do
      let(:conversation_id) { "999" }

      it "returns failure with conversation not found error" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:conversation_not_found)
        expect(result.failure[:conversation_not_found]).to eq("Conversation not found")
      end

      it "does not delete any conversation" do
        expect { operation.call(params) }.not_to change(Ai::Conversation, :count)
      end
    end

    context "when conversation exists but belongs to different user" do
      let(:other_user) { create(:user) }
      let(:other_conversation) { create(:ai_conversation, user: other_user, space:) }
      let(:conversation_id) { other_conversation.id.to_s }

      it "returns failure with conversation not found error" do
        # Create the conversation first
        other_conversation
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:conversation_not_found)
        expect(result.failure[:conversation_not_found]).to eq("Conversation not found")
      end

      it "does not delete any conversation" do
        # Create the conversation first
        other_conversation
        expect { operation.call(params) }.not_to change(Ai::Conversation, :count)
      end
    end

    context "when conversation exists but belongs to different space" do
      let(:other_space) { create(:space) }
      let(:other_conversation) { create(:ai_conversation, user:, space: other_space) }
      let(:conversation_id) { other_conversation.id.to_s }

      it "returns failure with conversation not found error" do
        # Create the conversation first
        other_conversation
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:conversation_not_found)
        expect(result.failure[:conversation_not_found]).to eq("Conversation not found")
      end

      it "does not delete any conversation" do
        # Create the conversation first
        other_conversation
        expect { operation.call(params) }.not_to change(Ai::Conversation, :count)
      end
    end
  end

  describe "#find_conversation" do
    it "finds conversation with correct parameters" do
      result = operation.send(:find_conversation, params:)
      expect(result).to be_success
      expect(result.value!).to eq(conversation)
    end

    it "returns failure when conversation is not found" do
      params_with_invalid_id = params.merge(conversation_id: "999")
      result = operation.send(:find_conversation, params: params_with_invalid_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:conversation_not_found)
    end
  end

  describe "#delete_database_conversation" do
    it "successfully deletes the conversation" do
      # Create the conversation first
      conversation
      result = operation.send(:delete_database_conversation, conversation:)
      expect(result).to be_success
      expect(result.value!).to eq(conversation)
    end

    it "returns failure when deletion fails" do
      # Create the conversation first
      conversation
      allow(conversation).to receive(:destroy!).and_raise(StandardError.new("Database error"))
      result = operation.send(:delete_database_conversation, conversation:)
      expect(result).to be_failure
      expect(result.failure).to have_key(:database_error)
      expect(result.failure[:database_error]).to eq("Database error")
    end
  end
end
