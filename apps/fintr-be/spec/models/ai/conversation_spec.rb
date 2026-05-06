# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::Conversation, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user).class_name("Auth::User") }
    it { is_expected.to belong_to(:space).class_name("Spaces::Space") }
    it { is_expected.to have_many(:conversation_messages).class_name("Ai::ConversationMessage").dependent(:destroy) }
  end

  describe 'validations' do
    subject { build(:ai_conversation) }

    it { is_expected.to validate_presence_of(:title) }
  end

  describe 'scopes' do
    let(:user) { create(:user) }
    let(:space) { create(:space) }
    let!(:conversation1) { create(:ai_conversation, user: user, space: space, last_message_at: 2.days.ago) }
    let!(:conversation2) { create(:ai_conversation, user: user, space: space, last_message_at: 1.day.ago) }
    let!(:other_user_conversation) { create(:ai_conversation, space: space, last_message_at: 1.hour.ago) }

    describe '.for_user' do
      it 'returns conversations for the specified user' do
        expect(described_class.for_user(user.id)).to include(conversation1, conversation2)
        expect(described_class.for_user(user.id)).not_to include(other_user_conversation)
      end
    end

    describe '.for_space' do
      it 'returns conversations for the specified space' do
        expect(described_class.for_space(space.id)).to include(conversation1, conversation2, other_user_conversation)
      end
    end

    describe '.recent' do
      it 'orders conversations by last_message_at and created_at in descending order' do
        recent_conversations = described_class.recent
        expect(recent_conversations.first).to eq(other_user_conversation)
        expect(recent_conversations.second).to eq(conversation2)
        expect(recent_conversations.third).to eq(conversation1)
      end
    end
  end

  describe 'instance methods' do
    let(:conversation) { create(:ai_conversation) }

    describe '#update_last_message_at!' do
      it 'updates the last_message_at timestamp to current time' do
        conversation.update!(last_message_at: 1.hour.ago)
        freeze_time do
          expect { conversation.update_last_message_at! }
            .to change(conversation, :last_message_at)
            .to(Time.current)
        end
      end
    end

    describe '#add_user_message' do
      let(:content) { "Hello, how are you?" }

      it 'creates a new conversation message with user role' do
        expect { conversation.add_user_message(content) }
          .to change(conversation.conversation_messages, :count)
          .by(1)
      end

      it 'creates a message with correct attributes' do
        message = conversation.add_user_message(content)
        expect(message.content).to eq(content)
        expect(message.openai_role).to eq("user")
      end

      it 'updates the last_message_at timestamp' do
        conversation.update!(last_message_at: 1.hour.ago)
        freeze_time do
          expect { conversation.add_user_message(content) }
            .to change(conversation, :last_message_at)
            .to(Time.current)
        end
      end

      it 'returns the created message' do
        message = conversation.add_user_message(content)
        expect(message).to be_a(Ai::ConversationMessage)
        expect(message).to be_persisted
      end
    end

    describe '#add_assistant_message' do
      let(:content) { "I'm doing well, thank you!" }
      let(:metadata) { { "model" => "gpt-4", "tokens" => 150 } }

      it 'creates a new conversation message with assistant role' do
        expect { conversation.add_assistant_message(content, metadata) }
          .to change(conversation.conversation_messages, :count)
          .by(1)
      end

      it 'creates a message with correct attributes' do
        message = conversation.add_assistant_message(content, metadata)
        expect(message.content).to eq(content)
        expect(message.openai_role).to eq("assistant")
        expect(message.metadata).to eq(metadata)
      end

      it 'updates the last_message_at timestamp' do
        conversation.update!(last_message_at: 1.hour.ago)
        freeze_time do
          expect { conversation.add_assistant_message(content, metadata) }
            .to change(conversation, :last_message_at)
            .to(Time.current)
        end
      end

      it 'returns the created message' do
        message = conversation.add_assistant_message(content, metadata)
        expect(message).to be_a(Ai::ConversationMessage)
        expect(message).to be_persisted
      end

      context 'when no metadata is provided' do
        it 'creates a message with empty metadata' do
          message = conversation.add_assistant_message(content)
          expect(message.metadata).to eq({})
        end
      end
    end

    describe '#messages_chronological' do
      let!(:message1) { create(:ai_conversation_message, conversation: conversation, created_at: 1.hour.ago) }
      let!(:message2) { create(:ai_conversation_message, conversation: conversation, created_at: 30.minutes.ago) }
      let!(:message3) { create(:ai_conversation_message, conversation: conversation, created_at: 10.minutes.ago) }

      it 'returns messages in chronological order' do
        messages = conversation.messages_chronological
        expect(messages).to eq([message1, message2, message3])
      end
    end

    describe '#last_message' do
      let!(:message1) { create(:ai_conversation_message, conversation: conversation, created_at: 1.hour.ago) }
      let!(:message2) { create(:ai_conversation_message, conversation: conversation, created_at: 30.minutes.ago) }
      let!(:message3) { create(:ai_conversation_message, conversation: conversation, created_at: 10.minutes.ago) }

      it 'returns the most recently created message' do
        expect(conversation.last_message).to eq(message3)
      end
    end
  end

  describe 'factory' do
    it 'creates a valid conversation' do
      conversation = build(:ai_conversation)
      expect(conversation).to be_valid
    end

    it 'creates a conversation with all required attributes' do
      conversation = create(:ai_conversation)
      expect(conversation.title).to be_present
      expect(conversation.user).to be_present
      expect(conversation.space).to be_present
    end
  end
end
