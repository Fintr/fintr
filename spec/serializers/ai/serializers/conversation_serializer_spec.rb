# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::Serializers::ConversationSerializer do
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

  describe 'serialization structure' do
    it 'serializes all expected fields' do
      expected_keys = [
        :id,
        :title,
        :last_message_at,
        :created_at,
        :updated_at,
        :message_count
      ]
      expect(serialized_hash.keys).to match_array(expected_keys)
    end

    it 'returns a hash with string keys' do
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
  end
end
