# frozen_string_literal: true

FactoryBot.define do
  factory :ai_conversation, class: "Ai::Conversation" do
    association :user, factory: :user
    association :space, factory: :space
    title { "Test Conversation" }
    openai_conversation_id { SecureRandom.uuid }
    last_message_at { Time.current }

    trait :with_messages do
      after(:create) do |conversation|
        create(:ai_conversation_message, conversation: conversation, openai_role: :user)
        create(:ai_conversation_message, conversation: conversation, openai_role: :assistant)
      end
    end

    trait :recent do
      last_message_at { 1.hour.ago }
    end

    trait :old do
      last_message_at { 1.week.ago }
    end
  end
end
