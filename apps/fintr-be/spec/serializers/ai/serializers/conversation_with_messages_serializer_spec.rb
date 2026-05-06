# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::Serializers::ConversationWithMessagesSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(conversation) }

  let!(:user) { create(:user) }
  let!(:space) { create(:space) }
  let!(:conversation) { create(:ai_conversation, user: user, space: space) }

  describe 'basic fields' do
    it 'includes the id' do
      expect(serialized_hash[:id]).to eq(conversation.id)
    end

    it 'includes the title' do
      expect(serialized_hash[:title]).to eq(conversation.title)
    end

    it 'includes the last_message_at' do
      expect(serialized_hash[:last_message_at]).to eq(conversation.last_message_at)
    end

    it 'includes the created_at' do
      expect(serialized_hash[:created_at]).to eq(conversation.created_at)
    end

    it 'includes the updated_at' do
      expect(serialized_hash[:updated_at]).to eq(conversation.updated_at)
    end
  end

  describe 'message_count field' do
    context 'when conversation has no messages' do
      it 'returns 0 for message_count' do
        expect(serialized_hash[:message_count]).to eq(0)
      end
    end

    context 'when conversation has messages' do
      let!(:message1) { create(:ai_conversation_message, conversation: conversation) }
      let!(:message2) { create(:ai_conversation_message, conversation: conversation) }

      it 'returns the correct count of messages' do
        expect(serialized_hash[:message_count]).to eq(2)
      end
    end

    context 'when conversation has multiple messages' do
      let!(:messages) { create_list(:ai_conversation_message, 5, conversation: conversation) }

      it 'returns the correct count of messages' do
        expect(serialized_hash[:message_count]).to eq(5)
      end
    end
  end

  describe 'messages field' do
    context 'when conversation has no messages' do
      it 'returns an empty array for messages' do
        expect(serialized_hash[:messages]).to eq([])
      end
    end

    context 'when conversation has one message' do
      let!(:message) { create(:ai_conversation_message, conversation: conversation) }

      it 'returns an array with one serialized message' do
        expect(serialized_hash[:messages]).to be_an(Array)
        expect(serialized_hash[:messages].length).to eq(1)
      end

      it 'serializes the message using ConversationMessageSerializer' do
        expected_message = Ai::Serializers::ConversationMessageSerializer.render_as_hash(message)
        expect(serialized_hash[:messages].first).to eq(expected_message)
      end
    end

    context 'when conversation has multiple messages' do
      let!(:message1) { create(:ai_conversation_message, conversation: conversation, created_at: 1.hour.ago) }
      let!(:message2) { create(:ai_conversation_message, conversation: conversation, created_at: 2.hours.ago) }
      let!(:message3) { create(:ai_conversation_message, conversation: conversation, created_at: 3.hours.ago) }

      it 'returns an array with all serialized messages' do
        expect(serialized_hash[:messages]).to be_an(Array)
        expect(serialized_hash[:messages].length).to eq(3)
      end

      it 'orders messages chronologically' do
        # messages_chronological orders by created_at ASC
        expected_order = [message3, message2, message1]
        serialized_messages = serialized_hash[:messages]

        expected_order.each_with_index do |expected_message, index|
          expected_serialized = Ai::Serializers::ConversationMessageSerializer.render_as_hash(expected_message)
          expect(serialized_messages[index]).to eq(expected_serialized)
        end
      end

      it 'serializes each message using ConversationMessageSerializer' do
        serialized_messages = serialized_hash[:messages]

        serialized_messages.each_with_index do |serialized_message, index|
          expected_message = conversation.messages_chronological[index]
          expected_serialized = Ai::Serializers::ConversationMessageSerializer.render_as_hash(expected_message)
          expect(serialized_message).to eq(expected_serialized)
        end
      end
    end

    context 'when conversation has messages with different roles' do
      let!(:user_message) { create(:ai_conversation_message, :user_message, conversation: conversation) }
      let!(:assistant_message) { create(:ai_conversation_message, :assistant_message, conversation: conversation) }

      it 'includes both user and assistant messages' do
        expect(serialized_hash[:messages].length).to eq(2)
      end

      it 'serializes each message with correct role information' do
        serialized_messages = serialized_hash[:messages]

        user_serialized = serialized_messages.find { |msg| msg[:openai_role] == 'user' }
        assistant_serialized = serialized_messages.find { |msg| msg[:openai_role] == 'assistant' }

        expect(user_serialized).to be_present
        expect(assistant_serialized).to be_present
      end
    end
  end

  describe 'serialization structure' do
    it 'serializes all expected fields' do
      expected_keys = [
        :id,
        :title,
        :last_message_at,
        :created_at,
        :updated_at,
        :message_count,
        :messages
      ]
      expect(serialized_hash.keys).to match_array(expected_keys)
    end

    it 'returns a hash with symbol keys' do
      expect(serialized_hash).to be_a(Hash)
      expect(serialized_hash.keys).to all(be_a(Symbol))
    end
  end

  context 'with different conversation states' do
    context 'when conversation has recent last_message_at' do
      let!(:recent_conversation) { create(:ai_conversation, :recent, user: user, space: space) }

      it 'includes the recent last_message_at timestamp' do
        serialized = described_class.render_as_hash(recent_conversation)
        expect(serialized[:last_message_at]).to eq(recent_conversation.last_message_at)
      end
    end

    context 'when conversation is old' do
      let!(:old_conversation) { create(:ai_conversation, :old, user: user, space: space) }

      it 'includes the old last_message_at timestamp' do
        serialized = described_class.render_as_hash(old_conversation)
        expect(serialized[:last_message_at]).to eq(old_conversation.last_message_at)
      end
    end
  end

  context 'with conversation messages' do
    let!(:conversation_with_messages) { create(:ai_conversation, :with_messages, user: user, space: space) }

    it 'correctly counts messages for conversation with messages' do
      serialized = described_class.render_as_hash(conversation_with_messages)
      expect(serialized[:message_count]).to eq(2)
    end

    it 'includes serialized messages' do
      serialized = described_class.render_as_hash(conversation_with_messages)
      expect(serialized[:messages]).to be_an(Array)
      expect(serialized[:messages].length).to eq(2)
    end
  end

  context 'with complex message scenarios' do
    let!(:conversation_with_complex_messages) do
      conv = create(:ai_conversation, user: user, space: space)

      # Create messages in different order to test chronological ordering
      create(:ai_conversation_message,
             conversation: conv,
             content: "First message",
             created_at: 3.hours.ago)
      create(:ai_conversation_message,
             conversation: conv,
             content: "Second message",
             created_at: 1.hour.ago)
      create(:ai_conversation_message,
             conversation: conv,
             content: "Third message",
             created_at: 2.hours.ago)

      conv
    end

    it 'orders messages chronologically regardless of creation order' do
      serialized = described_class.render_as_hash(conversation_with_complex_messages)
      messages = serialized[:messages]

      expect(messages[0][:content]).to eq("First message")
      expect(messages[1][:content]).to eq("Third message")
      expect(messages[2][:content]).to eq("Second message")
    end
  end

  context 'when testing message serialization consistency' do
    let!(:message) { create(:ai_conversation_message, :with_metadata, conversation: conversation) }

    it 'maintains consistency with direct ConversationMessageSerializer' do
      direct_serialization = Ai::Serializers::ConversationMessageSerializer.render_as_hash(message)
      embedded_serialization = serialized_hash[:messages].first

      expect(embedded_serialization).to eq(direct_serialization)
    end
  end
end
