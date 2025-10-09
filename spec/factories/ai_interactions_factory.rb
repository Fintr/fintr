# frozen_string_literal: true

FactoryBot.define do
  factory :ai_interaction, class: "Ai::Interaction" do
    association :user, factory: :user
    association :space, factory: :personal_space
    session_id { SecureRandom.uuid }
    request { "What are my spending patterns?" }
    response { nil }
    status { "pending" }
    error { nil }
    tokens_used { 0 }
    time_seconds { 0.0 }
    metadata { {} }
    enhanced_prompt { nil }

    trait :success do
      status { "success" }
      response { "Based on your data, here are your spending patterns..." }
      tokens_used { 150 }
      time_seconds { 2.5 }
      enhanced_prompt { "Enhanced prompt with context..." }
    end

    trait :failure do
      status { "failure" }
      error { "Processing error occurred" }
      tokens_used { 0 }
      time_seconds { 0.0 }
    end

    trait :pending do
      status { "pending" }
      response { nil }
      error { nil }
      tokens_used { 0 }
      time_seconds { 0.0 }
    end
  end
end
