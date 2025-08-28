# frozen_string_literal: true

FactoryBot.define do
  factory :ai_usage, class: "Ai::Usage" do
    association :user, factory: :user
    association :space, factory: :personal_space
    ai_type { "pure_ai_ocr" }
    status { "pending" }
    tokens_used { 1 }
    time_seconds { 0.0 }
    result { {} }

    trait :success do
      status { "success" }
      time_seconds { 2.5 }
    end

    trait :failure do
      status { "failure" }
      time_seconds { 1.0 }
      result { { error: "Something went wrong" } }
    end

    trait :ai_chat do
      ai_type { "ai_chat" }
    end
  end
end
