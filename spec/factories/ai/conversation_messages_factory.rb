# frozen_string_literal: true

FactoryBot.define do
  factory :ai_conversation_message, class: "Ai::ConversationMessage" do
    association :conversation, factory: :ai_conversation
    content { "Test message content" }
    openai_role { :user }
    metadata { {} }

    trait :user_message do
      openai_role { :user }
      content { "Hello, how can I help you?" }
    end

    trait :assistant_message do
      openai_role { :assistant }
      content { "I'm here to help you with your financial questions." }
      metadata { { model: "gpt-4", tokens: 50 } }
    end

    trait :with_metadata do
      metadata do
        {
          model: "gpt-4",
          tokens: 100,
          temperature: 0.7
        }
      end
    end
  end
end
