# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::Serializers::ConversationMessageSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(conversation_message) }

  let!(:conversation) { create(:ai_conversation) }
  let!(:conversation_message) { create(:ai_conversation_message, conversation: conversation) }

  it 'includes the id' do
    expect(serialized_hash[:id]).to eq(conversation_message.id)
  end

  it 'includes the content' do
    expect(serialized_hash[:content]).to eq(conversation_message.content)
  end

  it 'includes the openai_role' do
    expect(serialized_hash[:openai_role]).to eq(conversation_message.openai_role)
  end

  it 'includes the metadata' do
    expect(serialized_hash[:metadata]).to eq(conversation_message.metadata)
  end

  it 'includes the created_at' do
    expect(serialized_hash[:created_at]).to eq(conversation_message.created_at)
  end

  it 'serializes all expected top-level fields' do
    expected_keys = [
      :id,
      :content,
      :openai_role,
      :metadata,
      :created_at
    ]
    expect(serialized_hash.keys).to match_array(expected_keys)
  end

  context 'when conversation message has user role' do
    let!(:conversation_message) { create(:ai_conversation_message, :user_message, conversation: conversation) }

    it 'includes the user openai_role' do
      expect(serialized_hash[:openai_role]).to eq('user')
    end

    it 'includes the user content' do
      expect(serialized_hash[:content]).to eq('Hello, how can I help you?')
    end
  end

  context 'when conversation message has assistant role' do
    let!(:conversation_message) { create(:ai_conversation_message, :assistant_message, conversation: conversation) }

    it 'includes the assistant openai_role' do
      expect(serialized_hash[:openai_role]).to eq('assistant')
    end

    it 'includes the assistant content' do
      expect(serialized_hash[:content]).to eq("I'm here to help you with your financial questions.")
    end

    it 'includes the assistant metadata' do
      expect(serialized_hash[:metadata]).to eq({ "model" => "gpt-4", "tokens" => 50 })
    end
  end

  context 'when conversation message has metadata' do
    let!(:conversation_message) { create(:ai_conversation_message, :with_metadata, conversation: conversation) }

    it 'includes the metadata with model information' do
      expected_metadata = {
        "model" => "gpt-4",
        "tokens" => 100,
        "temperature" => 0.7
      }
      expect(serialized_hash[:metadata]).to eq(expected_metadata)
    end
  end

  context 'when conversation message has empty metadata' do
    let!(:conversation_message) { create(:ai_conversation_message, metadata: {}, conversation: conversation) }

    it 'includes empty metadata hash' do
      expect(serialized_hash[:metadata]).to eq({})
    end
  end

  context 'when conversation message has nil metadata' do
    let!(:conversation_message) { create(:ai_conversation_message, metadata: nil, conversation: conversation) }

    it 'includes nil metadata' do
      expect(serialized_hash[:metadata]).to be_nil
    end
  end

  context 'when testing with different content types' do
    let!(:conversation_message) do
      create(:ai_conversation_message,
             content: "This is a longer message with special characters: @#$%^&*()",
             conversation: conversation)
    end

    it 'preserves special characters in content' do
      expect(serialized_hash[:content]).to eq("This is a longer message with special characters: @#$%^&*()")
    end
  end

  context 'when testing with different openai roles' do
    let!(:conversation_message) do
      create(:ai_conversation_message,
             openai_role: :developer,
             conversation: conversation)
    end

    it 'includes the developer openai_role' do
      expect(serialized_hash[:openai_role]).to eq('developer')
    end
  end
end
